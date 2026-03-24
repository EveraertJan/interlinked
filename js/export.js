// export.js — SVG and PNG export

const Export = (() => {

  function timestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  }

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
  }

  function getBoundingBox(nodes) {
    if (!nodes.length) return { x: 0, y: 0, w: 800, h: 600 };
    const PAD = 60;
    let minX =  Infinity, minY =  Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });
    return { x: minX - PAD, y: minY - PAD, w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 };
  }

  // ── Bezier helpers (mirrors connections.js, needed for SVG path data) ───────

  function bezierControlPoints(fromPort, toPort, loop) {
    const dx = Math.abs(toPort.x - fromPort.x);
    const dy = toPort.y - fromPort.y;
    if (loop) {
      const loopH = 55 + Math.abs(dy) * 0.25;
      return {
        cp1: { x: fromPort.x + 40,     y: fromPort.y - loopH },
        cp2: { x: toPort.x  - 40,      y: toPort.y   - loopH },
      };
    }
    return {
      cp1: { x: fromPort.x + dx * 0.5, y: fromPort.y },
      cp2: { x: toPort.x  - dx * 0.5,  y: toPort.y  },
    };
  }

  // ── PNG export ─────────────────────────────────────────────────────────────

  function exportPNG(items) {
    const nodes       = State.getNodes();
    const connections = State.getConnections();
    const bb          = getBoundingBox(nodes);
    const DPR         = 2;

    const off   = document.createElement('canvas');
    off.width   = bb.w * DPR;
    off.height  = bb.h * DPR;
    const ctx   = off.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, off.width, off.height);

    ctx.save();
    ctx.scale(DPR, DPR);
    ctx.translate(-bb.x, -bb.y);

    Connections.drawAll(ctx, connections, nodes, null);
    Nodes.drawAll(ctx, nodes, items, [], null, null);

    ctx.restore();

    triggerDownload(off.toDataURL('image/png'), 'storyboard_' + timestamp() + '.png');
  }

  // ── SVG export ─────────────────────────────────────────────────────────────

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function exportSVG(items) {
    const nodes       = State.getNodes();
    const connections = State.getConnections();
    const bb          = getBoundingBox(nodes);

    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${bb.w}" height="${bb.h}" viewBox="${bb.x} ${bb.y} ${bb.w} ${bb.h}">`);
    out.push(`<style>text { font-family: Inter, sans-serif; }</style>`);
    out.push(`<rect x="${bb.x}" y="${bb.y}" width="${bb.w}" height="${bb.h}" fill="#f5f4f0"/>`);

    // ── Connections ──
    out.push('<g id="connections">');
    connections.forEach(conn => {
      const fromNode = nodes.find(n => n.id === conn.fromNodeId);
      const toNode   = nodes.find(n => n.id === conn.toNodeId);
      if (!fromNode || !toNode) return;

      const fromPort = Nodes.getPortPositions(fromNode).output;
      const toPort   = Nodes.getPortPositions(toNode).input;
      const { cp1, cp2 } = bezierControlPoints(fromPort, toPort, conn.isLoop);

      const d    = `M ${fromPort.x} ${fromPort.y} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${toPort.x} ${toPort.y}`;
      const dash = conn.isLoop ? ' stroke-dasharray="5,4"' : '';
      out.push(`<path d="${d}" stroke="#a0aab8" stroke-width="1.5" fill="none" opacity="0.6"${dash}/>`);
      out.push(`<circle cx="${fromPort.x}" cy="${fromPort.y}" r="3" fill="#a0aab8"/>`);
      out.push(`<circle cx="${toPort.x}"   cy="${toPort.y}"   r="3" fill="#a0aab8"/>`);
    });
    out.push('</g>');

    // ── Nodes ──
    out.push('<g id="nodes">');
    nodes.forEach(node => {
      const item = items[node.itemId];
      if (!item) return;
      const { x, y, width, height } = node;
      const color = Nodes.getSenseColor(item.sense || 'neutral');
      const lines = node._lines || [item.label];
      const totalH    = lines.length * 18;
      const textStartY = y + (height - totalH) / 2 + 9;

      out.push('<g>');
      // Drop shadow approximation via filter not standard — skip for simplicity
      // White background
      out.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white" stroke="#e4e4e0" stroke-width="1" rx="0"/>`);
      // Colour bar
      out.push(`<rect x="${x}" y="${y}" width="4" height="${height}" fill="${color}"/>`);
      // Agency dot
      const dotCx = x + 16, dotCy = y + height / 2;
      const agency = item.agency;
      if (agency === 'active') {
        out.push(`<circle cx="${dotCx}" cy="${dotCy}" r="4.5" fill="${color}"/>`);
      } else if (agency === 'passive') {
        out.push(`<circle cx="${dotCx}" cy="${dotCy}" r="3.75" fill="none" stroke="${color}" stroke-width="1.5"/>`);
      } else {
        out.push(`<path d="M ${dotCx} ${dotCy - 4.5} A 4.5 4.5 0 0 1 ${dotCx} ${dotCy + 4.5} Z" fill="${color}"/>`);
        out.push(`<circle cx="${dotCx}" cy="${dotCy}" r="3.75" fill="none" stroke="${color}" stroke-width="1.5"/>`);
      }
      // Label lines
      lines.forEach((line, i) => {
        out.push(`<text x="${x + 30}" y="${textStartY + i * 18}" font-size="13" fill="#1a1a1a" dominant-baseline="middle">${esc(line)}</text>`);
      });
      // Column name rotated in colour bar
      out.push(`<text transform="translate(${x + 2},${y + height / 2}) rotate(-90)" font-size="8" font-weight="500" fill="white" text-anchor="middle" dominant-baseline="middle">${esc((item.colName || '').toUpperCase())}</text>`);
      out.push('</g>');
    });
    out.push('</g>');

    // ── Logo ──
    out.push(`<text x="${bb.x + bb.w - 12}" y="${bb.y + bb.h - 12}" font-size="11" fill="#aaa" text-anchor="end">tastbaar.studio</text>`);

    out.push('</svg>');

    const blob = new Blob([out.join('\n')], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    triggerDownload(url, 'storyboard_' + timestamp() + '.svg');
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return { exportPNG, exportSVG };
})();

window.Export = Export;
