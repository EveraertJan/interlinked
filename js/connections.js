// connections.js — bezier curve drawing, connection logic, highlight

const Connections = (() => {

  // Any node can connect to any other node (no column restrictions)
  function canConnect(fromNode, toNode) {
    return !!(fromNode && toNode && fromNode.id !== toNode.id);
  }

  // Same-column connections render as dashed arcs
  function isLoop(fromNode, toNode) {
    return fromNode.colIndex === toNode.colIndex;
  }

  function getBezierPoints(fromPort, toPort, loop) {
    const dx = Math.abs(toPort.x - fromPort.x);
    const dy = toPort.y - fromPort.y;

    if (loop) {
      const loopH = 55 + Math.abs(dy) * 0.25;
      return {
        cp1: { x: fromPort.x + 40, y: fromPort.y - loopH },
        cp2: { x: toPort.x - 40,   y: toPort.y - loopH },
      };
    }

    return {
      cp1: { x: fromPort.x + dx * 0.5, y: fromPort.y },
      cp2: { x: toPort.x  - dx * 0.5, y: toPort.y  },
    };
  }

  function drawConnection(ctx, fromPort, toPort, isSelected, loop) {
    const { cp1, cp2 } = getBezierPoints(fromPort, toPort, loop);

    ctx.save();
    ctx.setLineDash(loop ? [5, 4] : []);
    ctx.globalAlpha = isSelected ? 1 : 0.4;

    ctx.beginPath();
    ctx.moveTo(fromPort.x, fromPort.y);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, toPort.x, toPort.y);
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth   = isSelected ? 2 : 1;
    ctx.stroke();
    ctx.setLineDash([]);

    // Endpoint dots — match reference DOT_R style
    [fromPort, toPort].forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isSelected ? 3 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#1A1A1A';
      ctx.fill();
    });

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawLiveCurve(ctx, fromPort, cursorWorld, backward) {
    const dx = Math.abs(cursorWorld.x - fromPort.x);
    const cp1 = backward
      ? { x: fromPort.x - dx * 0.5,    y: fromPort.y }
      : { x: fromPort.x + dx * 0.5,    y: fromPort.y };
    const cp2 = backward
      ? { x: cursorWorld.x + dx * 0.5, y: cursorWorld.y }
      : { x: cursorWorld.x - dx * 0.5, y: cursorWorld.y };

    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(fromPort.x, fromPort.y);
    ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, cursorWorld.x, cursorWorld.y);
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth   = 1;
    ctx.globalAlpha = 0.45;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Sample bezier curve at parameter t ∈ [0,1]
  function bezierPoint(p0, cp1, cp2, p1, t) {
    const mt = 1 - t;
    return {
      x: mt*mt*mt*p0.x + 3*mt*mt*t*cp1.x + 3*mt*t*t*cp2.x + t*t*t*p1.x,
      y: mt*mt*mt*p0.y + 3*mt*mt*t*cp1.y + 3*mt*t*t*cp2.y + t*t*t*p1.y,
    };
  }

  function hitTestConnection(conn, nodes, wx, wy) {
    const fromNode = nodes.find(n => n.id === conn.fromNodeId);
    const toNode   = nodes.find(n => n.id === conn.toNodeId);
    if (!fromNode || !toNode) return false;

    const fromPort = Nodes.getPortPositions(fromNode).output;
    const toPort   = Nodes.getPortPositions(toNode).input;
    const loop = conn.isLoop;
    const { cp1, cp2 } = getBezierPoints(fromPort, toPort, loop);

    const SAMPLES = 24;
    const THRESHOLD = 8;
    for (let i = 0; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const pt = bezierPoint(fromPort, cp1, cp2, toPort, t);
      const dx = pt.x - wx;
      const dy = pt.y - wy;
      if (dx*dx + dy*dy <= THRESHOLD * THRESHOLD) return true;
    }
    return false;
  }

  function getHighlightMap(draggingFromNode) {
    // Source node stays full opacity; everything else dims slightly to show it's a valid target
    const map = {};
    State.getNodes().forEach(node => {
      map[node.id] = node.id === draggingFromNode.id ? 1 : 0.65;
    });
    return map;
  }

  function drawAll(ctx, connections, nodes, selectedConnId) {
    connections.forEach(conn => {
      const fromNode = nodes.find(n => n.id === conn.fromNodeId);
      const toNode   = nodes.find(n => n.id === conn.toNodeId);
      if (!fromNode || !toNode) return;
      const fromPort = Nodes.getPortPositions(fromNode).output;
      const toPort   = Nodes.getPortPositions(toNode).input;
      const isSelected = conn.id === selectedConnId;
      drawConnection(ctx, fromPort, toPort, isSelected, conn.isLoop);
    });
  }

  return {
    canConnect,
    isLoop,
    drawConnection,
    drawLiveCurve,
    hitTestConnection,
    getHighlightMap,
    drawAll,
  };
})();

window.Connections = Connections;
