// nodes.js — node creation, drawing, hit testing

const Nodes = (() => {
  const NODE_WIDTH = 200;
  const PORT_VISUAL_R = 4;
  const PORT_HIT_R = 24;
  const DESC_ICON_R = 7;
  const DESC_ICON_HIT_R = 12;
  const COL_BAR = 4;
  const AGENCY_DOT_X = 18; // x center of agency dot relative to node left
  const LABEL_X = 30;      // label start x relative to node left (after bar + dot)
  const PADDING_TOP = 6;
  const PADDING_BOT = 6;
  const LINE_H = 8;
  const MIN_HEIGHT = 36;

  const SENSES = {
    sight:          '#c8a828',
    hearing:        '#4898c0',
    touch:          '#c85060',
    smell:          '#48a858',
    taste:          '#8050c8',
    proprioception: '#c87030',
    neural:         '#30a888',
    spatial:        '#6070c0',
    neutral:        '#b0b0b0',
  };

  // Off-screen canvas used for text measurement
  const measureCtx = document.createElement('canvas').getContext('2d');

  function getSenseColor(sense) {
    return SENSES[sense] || SENSES.neutral;
  }

  function measureLabel(label, maxWidth) {
    measureCtx.font = '12px Inter, sans-serif';
    const words = label.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (measureCtx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function computeHeight(lines) {
    return Math.max(MIN_HEIGHT, PADDING_TOP + lines.length * LINE_H + PADDING_BOT);
  }

  function createNode(itemId, item, colIndex, wx, wy) {
    // Measure label to determine height
    const availWidth = NODE_WIDTH - LABEL_X - 8;
    const lines = measureLabel(item.label, availWidth);
    const height = computeHeight(lines);
    return {
      id: crypto.randomUUID(),
      itemId,
      colIndex,
      x: wx - NODE_WIDTH / 2,
      y: wy - height / 2,
      width: NODE_WIDTH,
      height,
      _lines: lines, // cache
    };
  }

  function getPortPositions(node) {
    return {
      input:  { x: node.x,                 y: node.y + node.height / 2 },
      output: { x: node.x + node.width,    y: node.y + node.height / 2 },
    };
  }

  function hitTestNode(node, wx, wy) {
    return wx >= node.x && wx <= node.x + node.width &&
           wy >= node.y && wy <= node.y + node.height;
  }

  // Returns 'input' | 'body' | 'output' | null based on horizontal zone within node
  function getNodeZone(node, wx, wy) {
    if (!hitTestNode(node, wx, wy)) return null;
    const relX = wx - node.x;
    if (relX <= node.width * 0.25) return node.colIndex === 0 ? 'body' : 'input';
    if (relX >= node.width * 0.75) return node.colIndex === 4 ? 'body' : 'output';
    return 'body';
  }

  // Returns {x, y} of the ⓘ badge, or null if node has no description
  function getDescIconPos(node) {
    if (!node.description) return null;
    return { x: node.x + node.width - DESC_ICON_R - 4, y: node.y + DESC_ICON_R + 4 };
  }

  function hitTestDescIcon(node, wx, wy) {
    const pos = getDescIconPos(node);
    if (!pos) return false;
    const dx = wx - pos.x, dy = wy - pos.y;
    return dx * dx + dy * dy <= DESC_ICON_HIT_R * DESC_ICON_HIT_R;
  }

  function hitTestPort(node, wx, wy) {
    const ports = getPortPositions(node);
    if (node.colIndex !== 0) {
      const dx_in = wx - ports.input.x;
      const dy_in = wy - ports.input.y;
      if (dx_in * dx_in + dy_in * dy_in <= PORT_HIT_R * PORT_HIT_R) return 'input';
    }
    if (node.colIndex !== 4) {
      const dx_out = wx - ports.output.x;
      const dy_out = wy - ports.output.y;
      if (dx_out * dx_out + dy_out * dy_out <= PORT_HIT_R * PORT_HIT_R) return 'output';
    }
    return null;
  }

  function drawAgencyDot(ctx, cx, cy, agency, color) {
    const r = 4.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    if (agency === 'active') {
      ctx.fillStyle = color;
      ctx.fill();
    } else if (agency === 'passive') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // semi — half filled
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(cx, cy);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawNode(ctx, node, item, isSelected, opacity, hoveredPort, descIndex = null) {
    if (opacity !== undefined && opacity !== null) ctx.globalAlpha = opacity;
    const { x, y, width, height } = node;
    const color = getSenseColor(item.sense);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    const shadowOffset = 6;
    ctx.fillRect(x+shadowOffset, y+shadowOffset, width, height);

    // White fill
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, width, height);

    // // Border — black, thicker when selected
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = isSelected ? 1.5 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    // Agency dot
    const dotY = y + height / 2;
    const dotX = x + AGENCY_DOT_X;
    drawAgencyDot(ctx, dotX, dotY, item.agency, color);

    // Label
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = '#1a1a1a';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const lines = node._lines || measureLabel(item.label, width - LABEL_X - 8);
    const totalTextH = lines.length * LINE_H;
    const textStartY = y + (height - totalTextH) / 2 + LINE_H / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, x + LABEL_X, textStartY + i * LINE_H);
    });

    const ports = getPortPositions(node);
    const isHoverIn = hoveredPort && hoveredPort.nodeId === node.id && hoveredPort.side === 'input';
    const isHoverOut = hoveredPort && hoveredPort.nodeId === node.id && hoveredPort.side === 'output';

    // Input port (not on Input Device, col 0)
    if (node.colIndex !== 0) {
      ctx.beginPath();
      ctx.arc(ports.input.x, ports.input.y, PORT_VISUAL_R, 0, Math.PI * 2);
      ctx.fillStyle = isHoverIn ? color : '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }

    // Output port (not on Output Device, col 4)
    if (node.colIndex !== 4) {
      ctx.beginPath();
      ctx.arc(ports.output.x, ports.output.y, PORT_VISUAL_R, 0, Math.PI * 2);
      ctx.fillStyle = isHoverOut ? color : '#ffffff';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    }

    // Short label below node
    if (node.comment) {
      ctx.font = 'italic 11px Inter, sans-serif';
      ctx.fillStyle = '#888888';
      ctx.textBaseline = 'top';
      ctx.textAlign = 'center';
      ctx.fillText(node.comment, x + width / 2, y + height + 6);
    }

    // Index badge (top-right corner) when description exists
    if (node.description) {
      const ic = getDescIconPos(node);
      // ctx.beginPath();
      // ctx.arc(ic.x, ic.y, DESC_ICON_R, 0, Math.PI * 2);
      // ctx.fillStyle = '#e0e0da';
      // ctx.fill();
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.fillStyle = '#666';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(descIndex != null ? String(descIndex) : 'i', ic.x, ic.y + 0.5);
    }

    ctx.globalAlpha = 1;
  }

  // Returns a Map<nodeId, 1-based-index> for nodes that have descriptions,
  // sorted left-to-right then top-to-bottom.
  function buildDescIndexMap(nodes) {
    const annotated = [...nodes]
      .filter(n => n.description)
      .sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
    return new Map(annotated.map((n, i) => [n.id, i + 1]));
  }

  function drawAll(ctx, nodes, items, selectedIds, highlightMap, hoveredPort) {
    const selSet   = new Set(selectedIds || []);
    const idxMap   = buildDescIndexMap(nodes);
    nodes.forEach(node => {
      const item = items[node.itemId];
      if (!item) return;
      const isSelected = selSet.has(node.id);
      const opacity    = highlightMap ? (highlightMap[node.id] !== undefined ? highlightMap[node.id] : 1) : 1;
      drawNode(ctx, node, item, isSelected, opacity, hoveredPort, idxMap.get(node.id) ?? null);
    });
  }

  return {
    createNode,
    getPortPositions,
    hitTestNode,
    hitTestPort,
    getNodeZone,
    getDescIconPos,
    hitTestDescIcon,
    buildDescIndexMap,
    drawNode,
    drawAll,
    getSenseColor,
    NODE_WIDTH,
  };
})();

window.Nodes = Nodes;
