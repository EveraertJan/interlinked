// main.js — app init, data loading, event loop

(async () => {

  // ── Data loading & normalisation ──────────────────────────────────────────

  const COL_NAMES = ['Input Device', 'Input Effect', 'Manipulation', 'Output Effect', 'Output Device'];

  // Sense lookup — mirrors generate_svg.js SENSE_MAP
  const SENSE_MAP = {
    id_camera: 'sight', id_depth_camera: 'sight', id_microphone: 'hearing',
    id_keyboard: 'touch', id_mouse: 'touch', id_touch: 'touch', id_stylus: 'touch',
    id_imu: 'proprioception', id_eeg: 'neural', id_emg: 'neural',
    id_gsr: 'neural', id_ppg: 'neural', id_eye_tracker: 'sight',
    id_gps: 'spatial', id_lidar: 'spatial', id_gamepad: 'touch',
    id_breath_sensor: 'proprioception', id_fingerprint: 'touch',
    id_light_sensor: 'sight', id_pressure_sensor: 'touch',
    ie_hand_tracking: 'sight', ie_gesture: 'proprioception',
    ie_face_recognition: 'sight', ie_expression: 'sight', ie_gaze: 'sight',
    ie_blink: 'sight', ie_dilation: 'sight', ie_pose: 'proprioception',
    ie_motion_detection: 'spatial', ie_proximity: 'spatial',
    ie_voice: 'hearing', ie_pitch: 'hearing', ie_sound_trigger: 'hearing',
    ie_breath: 'proprioception', ie_keystroke: 'touch', ie_typing_rhythm: 'touch',
    ie_shortcut: 'touch', ie_cursor: 'touch', ie_scroll: 'touch',
    ie_hover: 'touch', ie_click: 'touch', ie_pressure: 'touch',
    ie_multi_touch: 'touch', ie_tilt: 'proprioception', ie_shake: 'proprioception',
    ie_orientation: 'spatial', ie_brain_signal: 'neural', ie_focus: 'neural',
    ie_muscle_signal: 'neural', ie_emotional_state: 'neural', ie_arousal: 'neural',
    ie_heartbeat: 'neural', ie_location: 'spatial', ie_movement_path: 'spatial',
    ie_identity: 'neural', ie_presence: 'spatial', ie_weight: 'proprioception',
    oe_light_colour: 'sight', oe_motion_animation: 'sight', oe_space_depth: 'sight',
    oe_text_symbols: 'sight', oe_presence: 'spatial', oe_tone_melody: 'hearing',
    oe_rhythm: 'hearing', oe_spatial_sound: 'hearing', oe_voice_language: 'hearing',
    oe_silence: 'hearing', oe_vibration: 'touch', oe_resistance: 'touch',
    oe_texture: 'touch', oe_temperature: 'touch', oe_weight_gravity: 'proprioception',
    oe_scent: 'smell', oe_taste: 'taste', oe_guidance: 'proprioception',
    oe_balance: 'proprioception', oe_full_body: 'proprioception',
    oe_ambient_light: 'sight', oe_air_wind: 'touch', oe_environment: 'spatial',
    od_screen: 'sight', od_projector: 'sight', od_hmd: 'sight', od_ar: 'sight',
    od_led: 'sight', od_laser: 'sight', od_retinal: 'sight', od_eink: 'sight',
    od_speakers: 'hearing', od_headphones: 'hearing', od_bone_conduction: 'hearing',
    od_spatial_audio: 'hearing', od_ultrasonic_audio: 'hearing',
    od_vibration_motor: 'touch', od_force_feedback: 'touch',
    od_ultrasonic_haptic: 'touch', od_tactile_array: 'touch', od_braille: 'touch',
    od_electrotactile: 'touch', od_thermal: 'touch', od_airflow: 'touch',
    od_robotic: 'proprioception', od_exoskeleton: 'proprioception',
    od_motion_platform: 'proprioception', od_ems: 'neural', od_neural: 'neural',
    od_olfactory: 'smell', od_taste_sim: 'taste', od_ambient_light: 'sight',
  };

  const AGENCY_VISUAL = {
    intentional:  'active',
    controlled:   'active',
    accidental:   'passive',
    uncontrolled: 'passive',
    both:         'semi',
  };

  let graphData;
  try {
    const res = await fetch('interaction_graph.json');
    graphData = await res.json();
  } catch (e) {
    console.error('Failed to load interaction_graph.json:', e);
    return;
  }

  // Flat items lookup: { itemId: normalised item }
  const items = {};
  graphData.columns.forEach((col, colIndex) => {
    col.items.forEach(raw => {
      // Manipulation column is always neutral; others use SENSE_MAP
      const sense = colIndex === 2 ? 'neutral' : (SENSE_MAP[raw.id] || 'neutral');
      items[raw.id] = {
        id:                raw.id,
        label:             raw.name,
        sense,
        agency:            AGENCY_VISUAL[raw.agency] || 'passive',
        colIndex,
        colName:           COL_NAMES[colIndex],
        connects_to:       raw.connects_to       || [],
        output_connects_to: raw.output_connects_to || [],
      };
    });
  });

  // ── Restore persisted state ───────────────────────────────────────────────

  State.loadRecent();
  const didRestore = State.load();

  // ── Init sub-modules ──────────────────────────────────────────────────────

  Picker.init(graphData.columns, items);

  // ── Interaction state ─────────────────────────────────────────────────────

  let selectedNodeIds = new Set();
  let selectedConnId  = null;
  let highlightMap    = null;   // { nodeId: opacity } while dragging connection
  let hoveredPort     = null;   // { nodeId, side }
  let liveCurve       = null;   // { fromPort, cursorWorld }
  let dragMode        = null;   // 'pan' | 'node' | 'connection'
  let spaceDown       = false;

  let panStart        = null;   // { vpX, vpY, clientX, clientY }
  let nodeDragState   = null;   // { nodeIds, starts, mouseWorld, moved }
  let connDragState   = null;   // { fromNode, fromPort, cursorWorld }

  const canvas = Canvas.el;

  // ── Draw callback ─────────────────────────────────────────────────────────

  Canvas.setDrawCallback((ctx) => {
    // Connections underneath nodes
    Connections.drawAll(ctx, State.getConnections(), State.getNodes(), selectedConnId);

    // Live bezier while dragging a new connection
    if (liveCurve) {
      Connections.drawLiveCurve(ctx, liveCurve.fromPort, liveCurve.cursorWorld, liveCurve.backward);
    }

    // Nodes
    Nodes.drawAll(ctx, State.getNodes(), items, [...selectedNodeIds], highlightMap, hoveredPort);
  });

  // ── Mouse: main canvas ────────────────────────────────────────────────────

  canvas.addEventListener('mousedown',   onMouseDown);
  canvas.addEventListener('dblclick',    e => openPickerAtPoint(e.clientX, e.clientY));
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('mousemove',   onMouseMove);
  window.addEventListener('mouseup',     onMouseUp);

  function openPickerAtPoint(clientX, clientY) {
    if (Picker.isOpen()) { Picker.close(); return; }
    const world = Canvas.screenToWorld(clientX, clientY);
    for (const n of State.getNodes()) {
      if (Nodes.hitTestNode(n, world.x, world.y)) return; // long-pressed a node, not empty space
    }
    Picker.open(world.x, world.y, clientX, clientY, (itemId, colIndex, wx, wy) => {
      const item = items[itemId];
      if (!item) return;
      State.addNode(Nodes.createNode(itemId, item, colIndex, wx, wy));
    }, 3);
  }

  function onMouseDown(e) {
    cancelMouseLongPress();
    hideContextMenu();

    // Middle-click or Space+drag → pan
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      e.preventDefault();
      const vp = State.getViewport();
      panStart = { vpX: vp.x, vpY: vp.y, clientX: e.clientX, clientY: e.clientY };
      dragMode = 'pan';
      canvas.style.cursor = 'grabbing';
      Canvas.startDragLoop();
      return;
    }

    if (e.button !== 0) return;

    const world = Canvas.screenToWorld(e.clientX, e.clientY);
    const nodes = State.getNodes();

    // Hit detection: zones (touch) vs port circles (mouse)
    let hitNode = null, hitSide = null;
    if (e._fromTouch) {
      // Touch: divide node into left-25% / middle-50% / right-25% zones
      for (let i = nodes.length - 1; i >= 0; i--) {
        const zone = Nodes.getNodeZone(nodes[i], world.x, world.y);
        if (zone) { hitNode = nodes[i]; hitSide = zone; break; }
      }
    } else {
      // Mouse: port circles first, then node body
      for (let i = nodes.length - 1; i >= 0; i--) {
        const side = Nodes.hitTestPort(nodes[i], world.x, world.y);
        if (side) { hitNode = nodes[i]; hitSide = side; break; }
      }
      if (!hitNode) {
        for (let i = nodes.length - 1; i >= 0; i--) {
          if (Nodes.hitTestNode(nodes[i], world.x, world.y)) { hitNode = nodes[i]; hitSide = 'body'; break; }
        }
      }
    }

    // ── Input side → backward connection drag ──
    if (hitNode && hitSide === 'input') {
      e.preventDefault();
      const fromPort = Nodes.getPortPositions(hitNode).input;
      connDragState  = { fromNode: hitNode, fromPort, cursorWorld: { ...world }, direction: 'backward' };
      liveCurve      = { fromPort, cursorWorld: { ...world }, backward: true };
      highlightMap   = Connections.getHighlightMap(hitNode);
      dragMode       = 'connection';
      Canvas.startDragLoop();
      return;
    }

    // ── Output side → forward connection drag ──
    if (hitNode && hitSide === 'output') {
      e.preventDefault();
      const fromPort  = Nodes.getPortPositions(hitNode).output;
      connDragState   = { fromNode: hitNode, fromPort, cursorWorld: { ...world }, direction: 'forward' };
      liveCurve       = { fromPort, cursorWorld: { ...world }, backward: false };
      highlightMap    = Connections.getHighlightMap(hitNode);
      dragMode        = 'connection';
      Canvas.startDragLoop();
      return;
    }

    // ── Node body → select + start drag ──
    if (hitNode) {
      e.preventDefault();
      if (!selectedNodeIds.has(hitNode.id)) {
        selectedNodeIds = new Set([hitNode.id]);
        selectedConnId  = null;
      }
      State.pushSnapshot();
      const starts = new Map();
      selectedNodeIds.forEach(id => {
        const n = nodes.find(n => n.id === id);
        if (n) starts.set(id, { x: n.x, y: n.y });
      });
      nodeDragState = { nodeIds: new Set(selectedNodeIds), starts, mouseWorld: { ...world }, moved: false };
      dragMode      = 'node';
      canvas.style.cursor = 'move';
      Canvas.startDragLoop();
      return;
    }

    // ── Connection hit-test ──
    const conns = State.getConnections();
    for (let i = conns.length - 1; i >= 0; i--) {
      if (Connections.hitTestConnection(conns[i], nodes, world.x, world.y)) {
        selectedNodeIds = new Set();
        selectedConnId  = conns[i].id;
        Canvas.render();
        return;
      }
    }

    // ── Empty canvas → deselect + pan (+ arm long-press for mouse) ──
    selectedNodeIds = new Set();
    selectedConnId  = null;
    const vp2 = State.getViewport();
    panStart = { vpX: vp2.x, vpY: vp2.y, clientX: e.clientX, clientY: e.clientY };
    dragMode = 'pan';
    canvas.style.cursor = 'grabbing';
    Canvas.startDragLoop();

    if (!e._fromTouch) {
      mouseLongPressOrigin = { x: e.clientX, y: e.clientY };
      mouseLongPressTimer  = setTimeout(() => {
        mouseLongPressTimer = null;
        panStart = null; dragMode = null;
        Canvas.stopDragLoop();
        canvas.style.cursor = spaceDown ? 'grab' : 'default';
        openPickerAtPoint(mouseLongPressOrigin.x, mouseLongPressOrigin.y);
      }, 500);
    }
  }

  function onMouseMove(e) {
    if (dragMode === 'pan' && panStart) {
      if (mouseLongPressOrigin) {
        const dx = e.clientX - mouseLongPressOrigin.x;
        const dy = e.clientY - mouseLongPressOrigin.y;
        if (dx * dx + dy * dy > 100) cancelMouseLongPress();
      }
      const vp = State.getViewport();
      State.setViewport({
        ...vp,
        x: panStart.vpX + (e.clientX - panStart.clientX),
        y: panStart.vpY + (e.clientY - panStart.clientY),
      });
      return;
    }

    if (dragMode === 'node' && nodeDragState) {
      const world = Canvas.screenToWorld(e.clientX, e.clientY);
      const dx = world.x - nodeDragState.mouseWorld.x;
      const dy = world.y - nodeDragState.mouseWorld.y;
      nodeDragState.moved = true;
      nodeDragState.nodeIds.forEach(id => {
        const s = nodeDragState.starts.get(id);
        if (s) State.updateNode(id, { x: s.x + dx, y: s.y + dy });
      });
      return;
    }

    if (dragMode === 'connection' && connDragState) {
      const world = Canvas.screenToWorld(e.clientX, e.clientY);
      connDragState.cursorWorld = { ...world };
      const bwd = connDragState.direction === 'backward';
      liveCurve = { fromPort: connDragState.fromPort, cursorWorld: { ...world }, backward: bwd };

      // Highlight the target port: any node body hit qualifies; side inferred from drag direction
      hoveredPort = null;
      const targetSide = bwd ? 'output' : 'input';
      const nodes = State.getNodes();
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (nodes[i].id !== connDragState.fromNode.id &&
            Nodes.hitTestNode(nodes[i], world.x, world.y)) {
          hoveredPort = { nodeId: nodes[i].id, side: targetSide };
          break;
        }
      }
      return;
    }

    // Hover — port-dot hit for cursor feedback (mouse only; touch has no hover)
    const world = Canvas.screenToWorld(e.clientX, e.clientY);
    const nodes = State.getNodes();
    let found = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const side = Nodes.hitTestPort(nodes[i], world.x, world.y);
      if (side) { found = { nodeId: nodes[i].id, side }; break; }
    }
    if (!found) {
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (Nodes.hitTestNode(nodes[i], world.x, world.y)) { found = { nodeId: nodes[i].id, side: 'body' }; break; }
      }
    }
    const prevPort = hoveredPort;
    hoveredPort = (found?.side === 'input' || found?.side === 'output') ? found : null;
    canvas.style.cursor = found?.side === 'input' || found?.side === 'output'
      ? 'crosshair'
      : found?.side === 'body' ? 'grab' : (spaceDown ? 'grab' : 'default');
    if (JSON.stringify(hoveredPort) !== JSON.stringify(prevPort)) Canvas.render();
  }

  function onMouseUp(e) {
    cancelMouseLongPress();
    if (dragMode === 'pan') {
      panStart = null;
      canvas.style.cursor = spaceDown ? 'grab' : 'default';
      Canvas.stopDragLoop();
      dragMode = null;
      return;
    }

    if (dragMode === 'node') {
      if (nodeDragState?.moved) State.commitMove();
      nodeDragState = null;
      canvas.style.cursor = 'default';
      Canvas.stopDragLoop();
      dragMode = null;
      Canvas.render();
      return;
    }

    if (dragMode === 'connection' && connDragState) {
      liveCurve    = null;
      highlightMap = null;
      hoveredPort  = null;

      const world    = connDragState.cursorWorld;
      const backward = connDragState.direction === 'backward';
      const allNodes = State.getNodes();
      let targetNode = null;
      for (let i = allNodes.length - 1; i >= 0; i--) {
        if (allNodes[i].id !== connDragState.fromNode.id &&
            Nodes.hitTestNode(allNodes[i], world.x, world.y)) {
          targetNode = allNodes[i];
          break;
        }
      }

      if (targetNode && Connections.canConnect(connDragState.fromNode, targetNode)) {
        // ── Drop on existing node → create connection ──
        // Forward: fromNode(output) → target(input)
        // Backward: target(output) → fromNode(input)
        const fromN    = backward ? targetNode          : connDragState.fromNode;
        const toN      = backward ? connDragState.fromNode : targetNode;
        const dup = State.getConnections().find(c =>
          c.fromNodeId === fromN.id && c.toNodeId === toN.id
        );
        if (!dup) {
          State.addConnection({
            id:         crypto.randomUUID(),
            fromNodeId: fromN.id,
            toNodeId:   toN.id,
            isLoop:     Connections.isLoop(fromN, toN),
          });
        }
        connDragState = null;
        dragMode      = null;
        Canvas.stopDragLoop();
        Canvas.render();
      } else {
        // ── Drop on empty space → open picker, spawn + auto-connect ──
        const srcId     = connDragState.fromNode.id;
        const dropWorld = { ...connDragState.cursorWorld };
        const screenPos = Canvas.worldToScreen(dropWorld.x, dropWorld.y);

        connDragState = null;
        dragMode      = null;
        Canvas.stopDragLoop();
        Canvas.render();

        const srcColIndex = State.getNodes().find(n => n.id === srcId)?.colIndex ?? 0;
        // Forward → next tab; backward → previous tab
        const nextTab = backward
          ? Math.max(srcColIndex - 1, 0)
          : Math.min(srcColIndex + 1, 4);

        const srcItem   = items[State.getNodes().find(n => n.id === srcId)?.itemId];
        // Suggested only makes sense going forward (connects_to points downstream)
        const suggested = backward ? new Set() : new Set([
          ...(srcItem?.connects_to        || []),
          ...(srcItem?.output_connects_to || []),
        ]);

        Picker.open(dropWorld.x, dropWorld.y, screenPos.x, screenPos.y, (itemId, colIndex, wx, wy) => {
          const item = items[itemId];
          if (!item) return;
          const newNode = Nodes.createNode(itemId, item, colIndex, wx, wy);
          State.addNode(newNode);
          const srcNode = State.getNodes().find(n => n.id === srcId);
          if (srcNode) {
            // Forward: srcNode(output) → newNode(input)
            // Backward: newNode(output) → srcNode(input)
            const fromN = backward ? newNode  : srcNode;
            const toN   = backward ? srcNode  : newNode;
            State.addConnection({
              id:         crypto.randomUUID(),
              fromNodeId: fromN.id,
              toNodeId:   toN.id,
              isLoop:     Connections.isLoop(fromN, toN),
            });
          }
        }, nextTab, suggested);
      }
      return;
    }

    dragMode = null;
  }

  // ── Keyboard ──────────────────────────────────────────────────────────────

  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const cmd = e.metaKey || e.ctrlKey;

    if (cmd && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      State.undo();
      selectedNodeIds = new Set(); selectedConnId = null;
      return;
    }
    if (cmd && (e.key === 'Z' || (e.key === 'z' && e.shiftKey) || e.key === 'y')) {
      e.preventDefault();
      State.redo();
      selectedNodeIds = new Set(); selectedConnId = null;
      return;
    }
    if (cmd && e.key === 'a') {
      e.preventDefault();
      selectedNodeIds = new Set(State.getNodes().map(n => n.id));
      selectedConnId  = null;
      Canvas.render();
      return;
    }
    if (e.key === 'Escape') {
      selectedNodeIds = new Set();
      selectedConnId  = null;
      Picker.close();
      Canvas.render();
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      deleteSelected();
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      spaceDown = true;
      if (dragMode !== 'pan') canvas.style.cursor = 'grab';
    }
  });

  window.addEventListener('keyup', e => {
    if (e.key === ' ') {
      spaceDown = false;
      if (dragMode !== 'pan') canvas.style.cursor = 'default';
    }
  });

  // ── Delete helpers ────────────────────────────────────────────────────────

  function deleteSelected() {
    if (selectedConnId) {
      State.removeConnection(selectedConnId);
      selectedConnId = null;
      Canvas.render();
      return;
    }
    if (!selectedNodeIds.size) return;

    const ids   = [...selectedNodeIds];
    const conns = State.getConnections().filter(c =>
      ids.includes(c.fromNodeId) || ids.includes(c.toNodeId)
    );

    const doDelete = () => {
      State.removeNodes(ids);
      selectedNodeIds = new Set();
      Canvas.render();
    };

    if (conns.length > 0) {
      const label = ids.length === 1 ? 'node' : `${ids.length} nodes`;
      const cLabel = conns.length === 1 ? '1 connection' : `${conns.length} connections`;
      showConfirm(`Remove ${label} and ${cLabel}?`, doDelete, 'Remove');
    } else {
      doDelete();
    }
  }

  // ── Context menu ──────────────────────────────────────────────────────────

  const ctxMenu   = document.getElementById('context-menu');
  const ctxDelete = document.getElementById('ctx-delete');
  let ctxNodeId   = null;

  function onContextMenu(e) {
    e.preventDefault();
    const world = Canvas.screenToWorld(e.clientX, e.clientY);
    const nodes = State.getNodes();
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (Nodes.hitTestNode(nodes[i], world.x, world.y)) {
        ctxNodeId             = nodes[i].id;
        ctxMenu.style.left    = e.clientX + 'px';
        ctxMenu.style.top     = e.clientY  + 'px';
        ctxMenu.removeAttribute('hidden');
        return;
      }
    }
  }

  function hideContextMenu() {
    ctxMenu.setAttribute('hidden', '');
    ctxNodeId = null;
  }

  ctxDelete.addEventListener('click', () => {
    if (!ctxNodeId) return;
    const id    = ctxNodeId;
    hideContextMenu();
    const conns = State.getConnections().filter(c => c.fromNodeId === id || c.toNodeId === id);
    const doDelete = () => {
      State.removeNode(id);
      selectedNodeIds.delete(id);
      Canvas.render();
    };
    if (conns.length > 0) {
      const cLabel = conns.length === 1 ? '1 connection' : `${conns.length} connections`;
      showConfirm(`Remove node and ${cLabel}?`, doDelete, 'Remove');
    } else {
      doDelete();
    }
  });

  document.addEventListener('mousedown', e => {
    if (!ctxMenu.hasAttribute('hidden') && !ctxMenu.contains(e.target)) hideContextMenu();
  });

  // ── Confirm dialog ────────────────────────────────────────────────────────

  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmMsg    = document.getElementById('confirm-msg');
  const confirmOk     = document.getElementById('confirm-ok');
  const confirmCancel = document.getElementById('confirm-cancel');
  let confirmCb = null;

  function showConfirm(msg, cb, okLabel = 'Delete') {
    confirmMsg.textContent = msg;
    confirmOk.textContent  = okLabel;
    confirmCb = cb;
    confirmDialog.removeAttribute('hidden');
  }

  confirmOk.addEventListener('click', () => {
    confirmDialog.setAttribute('hidden', '');
    const cb = confirmCb; confirmCb = null;
    if (cb) cb();
  });
  confirmCancel.addEventListener('click', () => {
    confirmDialog.setAttribute('hidden', '');
    confirmCb = null;
  });

  // ── Auto-layout ───────────────────────────────────────────────────────────

  function autoLayout() {
    const nodes = State.getNodes();
    if (!nodes.length) return;

    State.pushSnapshot();

    const COL_X   = [80, 360, 640, 920, 1200];
    const byCol   = [[], [], [], [], []];
    nodes.forEach(n => (byCol[n.colIndex] || []).push(n));

    const targets = new Map();
    byCol.forEach((col, ci) => {
      col.sort((a, b) => a.y - b.y);
      let y = 80;
      col.forEach(n => {
        targets.set(n.id, { x: COL_X[ci], y });
        y += n.height + 24;
      });
    });

    const starts = new Map();
    nodes.forEach(n => starts.set(n.id, { x: n.x, y: n.y }));

    const DURATION = 300;
    const t0       = performance.now();

    function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

    function frame(now) {
      const t    = Math.min((now - t0) / DURATION, 1);
      const ease = easeInOut(t);
      nodes.forEach(n => {
        const s = starts.get(n.id);
        const g = targets.get(n.id);
        if (s && g) State.updateNode(n.id, {
          x: s.x + (g.x - s.x) * ease,
          y: s.y + (g.y - s.y) * ease,
        });
      });
      if (t < 1) requestAnimationFrame(frame);
      else State.commitMove();
    }

    requestAnimationFrame(frame);
  }

  // ── Toolbar buttons ───────────────────────────────────────────────────────

  document.getElementById('btn-new').addEventListener('click', () => {
    if (!State.getNodes().length) return;
    showConfirm('Clear the canvas and start a new board?', () => {
      State.clearAll();
      selectedNodeIds = new Set();
      selectedConnId  = null;
      Canvas.render();
    }, 'Clear');
  });

  document.getElementById('btn-undo').addEventListener('click', () => {
    State.undo();
    selectedNodeIds = new Set(); selectedConnId = null;
  });

  document.getElementById('btn-redo').addEventListener('click', () => {
    State.redo();
    selectedNodeIds = new Set(); selectedConnId = null;
  });

  document.getElementById('btn-layout').addEventListener('click', autoLayout);

  document.getElementById('btn-save').addEventListener('click', () => {
    const blob = new Blob([State.serialize()], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url, download: `storyboard_${new Date().toISOString().replace(/[:.]/g,'-').slice(0,19)}.json`,
    });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  const fileInput = document.getElementById('file-input');
  document.getElementById('btn-load').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    fileInput.value = '';
    const reader = new FileReader();
    reader.onload = ev => {
      const doLoad = () => {
        try {
          State.deserialize(ev.target.result);
          selectedNodeIds = new Set();
          selectedConnId  = null;
          Canvas.render();
        } catch {
          alert('Could not load board: invalid file.');
        }
      };
      if (State.getNodes().length) {
        showConfirm('Replace current canvas with loaded board?', doLoad, 'Replace');
      } else {
        doLoad();
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('btn-export-svg').addEventListener('click', () => Export.exportSVG(items));
  document.getElementById('btn-export-png').addEventListener('click', () => Export.exportPNG(items));

  // ── Touch support ─────────────────────────────────────────────────────────
  // mkEvt converts a Touch into the shape the existing mouse handlers expect.

  function mkEvt(touch) {
    return {
      clientX: touch.clientX, clientY: touch.clientY,
      button: 0, target: canvas,
      metaKey: false, ctrlKey: false, shiftKey: false,
      _fromTouch: true,
      preventDefault() {},
    };
  }

  let mouseLongPressTimer  = null;
  let mouseLongPressOrigin = null;

  function cancelMouseLongPress() {
    if (mouseLongPressTimer) { clearTimeout(mouseLongPressTimer); mouseLongPressTimer = null; }
    mouseLongPressOrigin = null;
  }

  let longPressTimer  = null;
  let longPressOrigin = null;  // { x, y } screen coords at touchstart
  let pinchState      = null;  // { dist, midX, midY } for two-finger pinch

  function cancelLongPress() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }

  function pinchDist(touches) {
    const dx = touches[1].clientX - touches[0].clientX;
    const dy = touches[1].clientY - touches[0].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  canvas.addEventListener('touchstart', e => {
    e.preventDefault();

    // ── Two fingers → enter pinch mode, cancel any single-touch drag ──
    if (e.touches.length === 2) {
      cancelLongPress();
      // Abort single-touch pan or node drag cleanly
      if (dragMode === 'pan') {
        panStart = null; dragMode = null; Canvas.stopDragLoop();
      } else if (dragMode === 'node' && nodeDragState) {
        nodeDragState.nodeIds.forEach(id => {
          const s = nodeDragState.starts.get(id);
          if (s) State.updateNode(id, s);
        });
        nodeDragState = null; dragMode = null; Canvas.stopDragLoop(); Canvas.render();
      } else if (dragMode === 'connection') {
        liveCurve = null; highlightMap = null; hoveredPort = null;
        connDragState = null; dragMode = null; Canvas.stopDragLoop(); Canvas.render();
      }
      pinchState = {
        dist: pinchDist(e.touches),
        midX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        midY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      };
      return;
    }

    // More than 2 fingers — ignore
    if (e.touches.length !== 1) { cancelLongPress(); pinchState = null; return; }

    pinchState = null;
    const touch = e.touches[0];
    cancelLongPress();

    const world = Canvas.screenToWorld(touch.clientX, touch.clientY);
    let onNode = false;
    for (let i = State.getNodes().length - 1; i >= 0; i--) {
      if (Nodes.hitTestNode(State.getNodes()[i], world.x, world.y)) { onNode = true; break; }
    }

    longPressOrigin = { x: touch.clientX, y: touch.clientY };
    longPressTimer  = setTimeout(() => {
      longPressTimer = null;
      if (onNode) {
        // Abort any node drag and show context menu
        if (dragMode === 'node' && nodeDragState) {
          nodeDragState.nodeIds.forEach(id => {
            const s = nodeDragState.starts.get(id);
            if (s) State.updateNode(id, s);
          });
          nodeDragState = null;
          dragMode      = null;
          Canvas.stopDragLoop();
          Canvas.render();
        }
        onContextMenu({ preventDefault() {}, clientX: longPressOrigin.x, clientY: longPressOrigin.y });
      } else {
        // Abort pan and open picker
        panStart = null; dragMode = null;
        Canvas.stopDragLoop();
        canvas.style.cursor = 'default';
        openPickerAtPoint(longPressOrigin.x, longPressOrigin.y);
      }
    }, 500);

    onMouseDown(mkEvt(touch));
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();

    // ── Two fingers → pinch-to-zoom ──
    if (e.touches.length === 2 && pinchState) {
      const newDist = pinchDist(e.touches);
      const newMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const newMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      const vp     = State.getViewport();
      const factor = newDist / pinchState.dist;
      const newZoom = Math.max(0.2, Math.min(3, vp.zoom * factor));
      // World point under the previous midpoint stays fixed
      const wx = (pinchState.midX - vp.x) / vp.zoom;
      const wy = (pinchState.midY - vp.y) / vp.zoom;
      State.setViewport({
        x:    newMidX - wx * newZoom,
        y:    newMidY - wy * newZoom,
        zoom: newZoom,
      });

      pinchState = { dist: newDist, midX: newMidX, midY: newMidY };
      return;
    }

    if (e.touches.length !== 1) { cancelLongPress(); return; }
    const touch = e.touches[0];
    // Cancel long-press if finger moved more than 10 px
    if (longPressOrigin) {
      const dx = touch.clientX - longPressOrigin.x;
      const dy = touch.clientY - longPressOrigin.y;
      if (dx * dx + dy * dy > 100) cancelLongPress();
    }
    onMouseMove(mkEvt(touch));
  }, { passive: false });

  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    // Leaving pinch (one finger lifted) — clear pinch state, don't trigger mouse up
    if (pinchState) {
      if (e.touches.length < 2) pinchState = null;
      return;
    }
    cancelLongPress();
    onMouseUp(mkEvt(e.changedTouches[0]));
  }, { passive: false });

  canvas.addEventListener('touchcancel', e => {
    pinchState = null;
    cancelLongPress();
    if (e.changedTouches[0]) onMouseUp(mkEvt(e.changedTouches[0]));
  }, { passive: false });

  // ── Initial render ────────────────────────────────────────────────────────

  Canvas.render();

})();
