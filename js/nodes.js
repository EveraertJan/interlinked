// nodes.js — node creation, drawing, hit testing

const Nodes = (() => {
  const NODE_WIDTH = 200;
  const PORT_VISUAL_R = 8;
  const PORT_HIT_R = 24;
  const COL_BAR = 4;
  const AGENCY_DOT_X = 16; // x center of agency dot relative to node left
  const LABEL_X = 30;      // label start x relative to node left (after bar + dot)
  const PADDING_TOP = 10;
  const PADDING_BOT = 10;
  const LINE_H = 18;
  const MIN_HEIGHT = 44;

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
    measureCtx.font = '13px Inter, sans-serif';
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
    if (relX <= node.width * 0.25) return 'input';
    if (relX >= node.width * 0.75) return 'output';
    return 'body';
  }

  function hitTestPort(node, wx, wy) {
    const ports = getPortPositions(node);
    const dx_in = wx - ports.input.x;
    const dy_in = wy - ports.input.y;
    if (dx_in * dx_in + dy_in * dy_in <= PORT_HIT_R * PORT_HIT_R) return 'input';
    const dx_out = wx - ports.output.x;
    const dy_out = wy - ports.output.y;
    if (dx_out * dx_out + dy_out * dy_out <= PORT_HIT_R * PORT_HIT_R) return 'output';
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

  function drawNode(ctx, node, item, isSelected, opacity, hoveredPort) {
    if (opacity !== undefined && opacity !== null) ctx.globalAlpha = opacity;
    const { x, y, width, height } = node;
    const color = getSenseColor(item.sense);

    // Shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.08)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;

    // White fill
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, width, height);
    ctx.restore();

    // Colour bar
    ctx.fillStyle = color;
    ctx.fillRect(x, y, COL_BAR, height);

    // Border
    ctx.strokeStyle = isSelected ? '#1a1a1a' : '#333333';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    // Agency dot
    const dotY = y + height / 2;
    const dotX = x + AGENCY_DOT_X;
    drawAgencyDot(ctx, dotX, dotY, item.agency, color);

    // Label
    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = '#1a1a1a';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const lines = node._lines || measureLabel(item.label, width - LABEL_X - 8);
    const totalTextH = lines.length * LINE_H;
    const textStartY = y + (height - totalTextH) / 2 + LINE_H / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, x + LABEL_X, textStartY + i * LINE_H);
    });

    // Column name (small caps, rotated along the colour bar)
    ctx.save();
    ctx.font = '500 8px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.translate(x + COL_BAR / 2, y + height / 2);
    ctx.rotate(-Math.PI / 2);
    const colName = (item.colName || '').toUpperCase();
    ctx.fillText(colName, 0, 0);
    ctx.restore();

    // Input port
    const ports = getPortPositions(node);
    const isHoverIn = hoveredPort && hoveredPort.nodeId === node.id && hoveredPort.side === 'input';
    const isHoverOut = hoveredPort && hoveredPort.nodeId === node.id && hoveredPort.side === 'output';

    ctx.beginPath();
    ctx.arc(ports.input.x, ports.input.y, PORT_VISUAL_R, 0, Math.PI * 2);
    ctx.fillStyle = isHoverIn ? color : '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    // Output port
    ctx.beginPath();
    ctx.arc(ports.output.x, ports.output.y, PORT_VISUAL_R, 0, Math.PI * 2);
    ctx.fillStyle = isHoverOut ? color : '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  function drawAll(ctx, nodes, items, selectedIds, highlightMap, hoveredPort) {
    const selSet = new Set(selectedIds || []);
    nodes.forEach(node => {
      const item = items[node.itemId];
      if (!item) return;
      const isSelected = selSet.has(node.id);
      const opacity = highlightMap ? (highlightMap[node.id] !== undefined ? highlightMap[node.id] : 1) : 1;
      drawNode(ctx, node, item, isSelected, opacity, hoveredPort);
    });
  }

  return {
    createNode,
    getPortPositions,
    hitTestNode,
    hitTestPort,
    getNodeZone,
    drawNode,
    drawAll,
    getSenseColor,
    NODE_WIDTH,
  };
})();

window.Nodes = Nodes;
