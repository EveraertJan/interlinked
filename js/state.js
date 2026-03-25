// state.js — single source of truth, undo/redo, localStorage, event emitter

const State = (() => {
  const MAX_UNDO = 50;
  const STORAGE_KEY = 'storyboard_canvas';
  const RECENT_KEY = 'storyboard_recent';

  let nodes = [];
  let connections = [];
  let viewport = { x: 0, y: 0, zoom: 1 };
  let projectName = 'Untitled';
  let undoStack = [];
  let redoStack = [];
  let lastSaved = null;
  let saveTimer = null;
  const listeners = {};
  let recentlyUsed = {}; // { colIndex: [itemId, ...] }

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(fn => fn(data));
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function snapshot() {
    return deepClone({ nodes, connections });
  }

  function pushUndo(snap) {
    undoStack.push(snap || snapshot());
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = [];
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      save();
    }, 1000);
  }

  // ── Public API ──

  function getNodes() { return nodes; }
  function getConnections() { return connections; }
  function getViewport() { return viewport; }
  function getProjectName() { return projectName; }
  function setProjectName(name) {
    projectName = name || 'Untitled';
    emit('projectName', projectName);
    scheduleSave();
  }

  function setViewport(vp) {
    viewport = vp;
    emit('viewport');
  }

  function addNode(node) {
    pushUndo();
    nodes.push(node);
    emit('change');
    scheduleSave();
  }

  function removeNode(id) {
    pushUndo();
    nodes = nodes.filter(n => n.id !== id);
    connections = connections.filter(c => c.fromNodeId !== id && c.toNodeId !== id);
    emit('change');
    scheduleSave();
  }

  function removeNodes(ids) {
    pushUndo();
    const idSet = new Set(ids);
    nodes = nodes.filter(n => !idSet.has(n.id));
    connections = connections.filter(c => !idSet.has(c.fromNodeId) && !idSet.has(c.toNodeId));
    emit('change');
    scheduleSave();
  }

  function updateNode(id, patch) {
    // Direct mutation — no undo push. Call commitMove() after drag ends.
    const node = nodes.find(n => n.id === id);
    if (node) Object.assign(node, patch);
    emit('change');
  }

  function commitMove() {
    // Called after a drag finishes — the pre-drag snapshot should already be on undoStack
    // (pushed by main.js at mousedown). Just schedule a save.
    scheduleSave();
  }

  function addConnection(conn) {
    pushUndo();
    connections.push(conn);
    emit('change');
    scheduleSave();
  }

  function removeConnection(id) {
    pushUndo();
    connections = connections.filter(c => c.id !== id);
    emit('change');
    scheduleSave();
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    const prev = undoStack.pop();
    nodes = prev.nodes;
    connections = prev.connections;
    emit('change');
    scheduleSave();
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    const next = redoStack.pop();
    nodes = next.nodes;
    connections = next.connections;
    emit('change');
    scheduleSave();
  }

  function clearAll() {
    pushUndo();
    nodes = [];
    connections = [];
    emit('change');
    scheduleSave();
  }

  function serialize() {
    return JSON.stringify({ nodes: deepClone(nodes), connections: deepClone(connections), viewport: deepClone(viewport), projectName });
  }

  function deserialize(json) {
    const data = JSON.parse(json);
    pushUndo();
    nodes = data.nodes || [];
    connections = data.connections || [];
    if (data.viewport) viewport = data.viewport;
    projectName = data.projectName || 'Untitled';
    emit('change');
    emit('projectName', projectName);
    scheduleSave();
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, serialize());
      lastSaved = new Date();
      emit('saved', lastSaved);
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      nodes = data.nodes || [];
      connections = data.connections || [];
      if (data.viewport) viewport = data.viewport;
      projectName = data.projectName || 'Untitled';
      return true;
    } catch (e) {
      return false;
    }
  }

  function getLastSaved() { return lastSaved; }

  function addRecentlyUsed(colIndex, itemId) {
    if (!recentlyUsed[colIndex]) recentlyUsed[colIndex] = [];
    recentlyUsed[colIndex] = recentlyUsed[colIndex].filter(id => id !== itemId);
    recentlyUsed[colIndex].unshift(itemId);
    if (recentlyUsed[colIndex].length > 6) recentlyUsed[colIndex].pop();
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recentlyUsed));
    } catch (e) {}
  }

  function getRecentlyUsed(colIndex) {
    return recentlyUsed[colIndex] || [];
  }

  function loadRecent() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) recentlyUsed = JSON.parse(raw);
    } catch (e) {}
  }

  // Push a snapshot onto the undo stack (called before a drag starts in main.js)
  function pushSnapshot() {
    pushUndo(snapshot());
  }

  return {
    on, emit,
    getNodes, getConnections, getViewport, getProjectName, setProjectName,
    setViewport,
    addNode, removeNode, removeNodes, updateNode, commitMove,
    addConnection, removeConnection,
    undo, redo,
    clearAll,
    serialize, deserialize,
    save, load, getLastSaved,
    addRecentlyUsed, getRecentlyUsed, loadRecent,
    pushSnapshot,
  };
})();

window.State = State;
