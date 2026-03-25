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
    return {
      x: minX - PAD, y: minY - PAD,
      w: maxX - minX + PAD * 2,
      h: maxY - minY + PAD * 2,
      maxNodesY: maxY,
    };
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

  // ── Text wrapping for SVG footnotes ─────────────────────────────────────────

  function wrapText(text, maxChars) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const candidate = current ? current + ' ' + word : word;
      if (candidate.length > maxChars && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [''];
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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

  function exportSVG(items) {
    const nodes       = State.getNodes();
    const connections = State.getConnections();
    const bb          = getBoundingBox(nodes);

    // ── Annotated nodes (have description) sorted left→right, top→bottom ──
    const annotated = [...nodes]
      .filter(n => n.description)
      .sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
    const indexMap = new Map(annotated.map((n, i) => [n.id, i + 1]));

    // ── Pre-compute footnote layout ──────────────────────────────────────────
    const FOOT_GAP  = 100;  // px below lowest node
    const LINE_H    = 18;
    const ROW_PAD   = 10;
    const HEADER_H  = 38;
    const WRAP_CHARS = 58;

    const COL_X_NUM  = bb.x + 28;         // right-align numbers here
    const COL_X_TYPE = bb.x + 40;
    const COL_X_LBL  = bb.x + 220;
    const COL_X_DESC = bb.x + 390;

    const footRows = annotated.map(n => {
      const item      = items[n.itemId];
      const descLines = wrapText(n.description || '', WRAP_CHARS);
      const rowH      = descLines.length * LINE_H + ROW_PAD * 2;
      return { node: n, item, descLines, rowH };
    });

    const footSectionH = annotated.length
      ? HEADER_H + footRows.reduce((s, r) => s + r.rowH, 0) + 40
      : 0;

    const footY   = bb.maxNodesY + FOOT_GAP;
    const totalH  = (footY - bb.y) + footSectionH;

    // ── Build SVG ────────────────────────────────────────────────────────────
    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${bb.w}" height="${totalH}" viewBox="${bb.x} ${bb.y} ${bb.w} ${totalH}">`);
    out.push(`<style>text { font-family: Inter, sans-serif; }</style>`);
    out.push(`<rect x="${bb.x}" y="${bb.y}" width="${bb.w}" height="${totalH}" fill="#f5f4f0"/>`);

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
      const color      = Nodes.getSenseColor(item.sense || 'neutral');
      const lines      = node._lines || [item.label];
      const totalH     = lines.length * 18;
      const textStartY = y + (height - totalH) / 2 + 9;
      const descIndex  = indexMap.get(node.id) ?? null;

      out.push('<g>');
      out.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white" stroke="#e4e4e0" stroke-width="1" rx="0"/>`);
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

      // Short label below node
      if (node.comment) {
        out.push(`<text x="${x + width / 2}" y="${y + height + 7}" font-size="11" font-style="italic" fill="#888" text-anchor="middle" dominant-baseline="hanging">${esc(node.comment)}</text>`);
      }

      // Index badge (top-right corner) — only for annotated nodes
      if (descIndex != null) {
        const icX = x + width - 11, icY = y + 11;
        out.push(`<circle cx="${icX}" cy="${icY}" r="7" fill="#e0e0da"/>`);
        out.push(`<text x="${icX}" y="${icY + 0.5}" font-size="8" font-weight="700" fill="#666" text-anchor="middle" dominant-baseline="middle">${descIndex}</text>`);
      }

      out.push('</g>');
    });
    out.push('</g>');

    // ── Footnote grid ────────────────────────────────────────────────────────
    if (annotated.length) {
      out.push('<g id="footnotes">');

      // White background panel
      out.push(`<rect x="${bb.x}" y="${footY - 20}" width="${bb.w}" height="${footSectionH + 20}" fill="#ffffff" opacity="0.7"/>`);

      // Divider line
      out.push(`<line x1="${bb.x + 20}" y1="${footY}" x2="${bb.x + bb.w - 20}" y2="${footY}" stroke="#c8c8c4" stroke-width="1"/>`);

      // Column headers
      const headY = footY + HEADER_H / 2;
      out.push(`<text x="${COL_X_NUM}"  y="${headY}" font-size="9" font-weight="700" fill="#aaa" text-anchor="end"  dominant-baseline="middle" letter-spacing="0.06em">№</text>`);
      out.push(`<text x="${COL_X_TYPE}" y="${headY}" font-size="9" font-weight="700" fill="#aaa" dominant-baseline="middle" letter-spacing="0.06em">TYPE</text>`);
      out.push(`<text x="${COL_X_LBL}"  y="${headY}" font-size="9" font-weight="700" fill="#aaa" dominant-baseline="middle" letter-spacing="0.06em">LABEL</text>`);
      out.push(`<text x="${COL_X_DESC}" y="${headY}" font-size="9" font-weight="700" fill="#aaa" dominant-baseline="middle" letter-spacing="0.06em">DESCRIPTION</text>`);

      // Rows
      let ry = footY + HEADER_H;
      footRows.forEach(({ node, item, descLines, rowH }, ri) => {
        if (ri % 2 === 0) {
          out.push(`<rect x="${bb.x + 20}" y="${ry}" width="${bb.w - 40}" height="${rowH}" fill="#f7f7f5"/>`);
        }

        const midY = ry + rowH / 2;

        // Index number
        out.push(`<text x="${COL_X_NUM}" y="${midY}" font-size="12" font-weight="700" fill="#888" text-anchor="end" dominant-baseline="middle">${ri + 1}</text>`);

        // Type (item label)
        out.push(`<text x="${COL_X_TYPE}" y="${midY}" font-size="12" fill="#1a1a1a" dominant-baseline="middle">${esc(item?.label || '')}</text>`);

        // Short label (node.comment)
        out.push(`<text x="${COL_X_LBL}" y="${midY}" font-size="12" fill="#666" font-style="italic" dominant-baseline="middle">${esc(node.comment || '')}</text>`);

        // Description (multi-line)
        descLines.forEach((line, li) => {
          const ty = ry + ROW_PAD + li * LINE_H + LINE_H / 2;
          out.push(`<text x="${COL_X_DESC}" y="${ty}" font-size="12" fill="#333" dominant-baseline="middle">${esc(line)}</text>`);
        });

        ry += rowH;
      });

      out.push('</g>');
    }

    // ── Logo ──
    const logoY = bb.y + totalH - 12;
    out.push(`<text x="${bb.x + bb.w - 12}" y="${logoY}" font-size="11" fill="#aaa" text-anchor="end">tastbaar.studio</text>`);

    out.push('</svg>');

    const blob = new Blob([out.join('\n')], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    triggerDownload(url, 'storyboard_' + timestamp() + '.svg');
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return { exportPNG, exportSVG };
})();

window.Export = Export;
