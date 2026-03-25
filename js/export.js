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
    if (!nodes.length) return { x: 0, y: 0, w: 800, h: 600, maxNodesY: 600 };
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

  // ── Bezier helpers ──────────────────────────────────────────────────────────

  function bezierControlPoints(fromPort, toPort) {
    const dx   = Math.abs(toPort.x - fromPort.x);
    const pull = Math.max(dx * 0.5, 80);
    return {
      cp1: { x: fromPort.x + pull, y: fromPort.y },
      cp2: { x: toPort.x  - pull,  y: toPort.y  },
    };
  }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Footnote caption-grid layout ────────────────────────────────────────────
  //
  //  Captions are arranged in a 3-column grid (or fewer if fewer annotations).
  //  Each card looks like:
  //
  //    1
  //    Type Name
  //    label (italic, if set)
  //
  //    Description text that wraps
  //    across multiple lines.
  //
  // Layout constants (world / SVG units — PNG scales by DPR separately)

  const NUM_COLS   = 3;
  const FOOT_GAP   = 80;   // below lowest node
  const SIDE_PAD   = 40;   // left/right inset from bb.x
  const COL_GAP    = 32;   // between columns
  const CARD_PT    = 20;   // card padding top
  const CARD_PB    = 24;   // card padding bottom
  const IDX_SIZE   = 10;   // index number font size
  const IDX_GAP    = 10;   // gap between index and type
  const TYPE_SIZE  = 13;
  const LBL_SIZE   = 11;
  const DESC_SIZE  = 12;
  const DESC_LH    = 17;   // description line height

  // Build all layout data needed by both canvas and SVG renderers.
  // wrapFn(text) → string[]  (caller provides wrapping strategy)
  function buildFootnoteLayout(annotated, items, colW, wrapFn) {
    const numCols = Math.min(NUM_COLS, annotated.length);

    const cards = annotated.map((node, idx) => {
      const item      = items[node.itemId];
      const descLines = wrapFn(node.description || '');
      const cardH =
        CARD_PT
        + IDX_SIZE + IDX_GAP            // index number
        + TYPE_SIZE + 4                  // type name
        + (node.comment ? LBL_SIZE + 6 : 2) // optional label + gap
        + descLines.length * DESC_LH
        + CARD_PB;
      return {
        node,
        item,
        descLines,
        cardH,
        col: idx % numCols,
        row: Math.floor(idx / numCols),
      };
    });

    // Row heights = tallest card in each row
    const numRows = Math.ceil(annotated.length / numCols);
    const rowH = Array.from({ length: numRows }, (_, r) =>
      Math.max(...cards.filter(c => c.row === r).map(c => c.cardH))
    );
    const rowY = [];
    let acc = 0;
    rowH.forEach(h => { rowY.push(acc); acc += h; });

    return { cards, rowH, rowY, numCols, totalH: acc };
  }

  // ── PNG footnotes (canvas 2D) ────────────────────────────────────────────────

  function wrapCanvas(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const candidate = cur ? cur + ' ' + w : w;
      if (ctx.measureText(candidate).width > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = candidate;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  function drawFootnotesCanvas(ctx, annotated, items, bb, footY) {
    if (!annotated.length) return;

    const numCols = Math.min(NUM_COLS, annotated.length);
    const colW    = (bb.w - SIDE_PAD * 2 - COL_GAP * (numCols - 1)) / numCols;

    // Set a reference font for measuring — use desc size
    ctx.font = `${DESC_SIZE}px Inter, sans-serif`;
    const wrap = text => wrapCanvas(ctx, text, colW - 4);

    const layout = buildFootnoteLayout(annotated, items, colW, wrap);

    // Divider
    ctx.beginPath();
    ctx.moveTo(bb.x + SIDE_PAD, footY);
    ctx.lineTo(bb.x + bb.w - SIDE_PAD, footY);
    ctx.strokeStyle = '#c8c8c4';
    ctx.lineWidth   = 0.5;
    ctx.stroke();

    layout.cards.forEach(({ node, item, descLines, col, row }) => {
      const cx = bb.x + SIDE_PAD + col * (colW + COL_GAP);
      const cy = footY + 20 + layout.rowY[row];
      let y = cy + CARD_PT;

      // Index number
      ctx.font      = `700 ${IDX_SIZE}px Inter, sans-serif`;
      ctx.fillStyle = '#aaa';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(annotated.indexOf(node) + 1), cx, y);
      y += IDX_SIZE + IDX_GAP;

      // Type name
      ctx.font      = `600 ${TYPE_SIZE}px Inter, sans-serif`;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillText(item?.label || '', cx, y);
      y += TYPE_SIZE + 4;

      // Short label
      if (node.comment) {
        ctx.font      = `italic ${LBL_SIZE}px Inter, sans-serif`;
        ctx.fillStyle = '#777';
        ctx.fillText(node.comment, cx, y);
        y += LBL_SIZE + 6;
      } else {
        y += 2;
      }

      // Description
      ctx.font      = `${DESC_SIZE}px Inter, sans-serif`;
      ctx.fillStyle = '#555';
      descLines.forEach(line => {
        ctx.fillText(line, cx, y);
        y += DESC_LH;
      });
    });
  }

  // ── SVG footnotes ────────────────────────────────────────────────────────────

  function wrapSVG(text, colW) {
    // Approximate: Inter 12px ≈ 6.4px per char
    const maxChars = Math.floor(colW / 6.4);
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      const candidate = cur ? cur + ' ' + w : w;
      if (candidate.length > maxChars && cur) { lines.push(cur); cur = w; }
      else cur = candidate;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  function buildSVGFootnotes(out, annotated, items, bb, footY) {
    if (!annotated.length) return 0;

    const numCols = Math.min(NUM_COLS, annotated.length);
    const colW    = (bb.w - SIDE_PAD * 2 - COL_GAP * (numCols - 1)) / numCols;
    const wrap    = text => wrapSVG(text, colW);

    const layout  = buildFootnoteLayout(annotated, items, colW, wrap);
    const originY = footY + 20;

    out.push('<g id="footnotes">');

    // Divider line
    out.push(`<line x1="${bb.x + SIDE_PAD}" y1="${footY}" x2="${bb.x + bb.w - SIDE_PAD}" y2="${footY}" stroke="#c8c8c4" stroke-width="0.5"/>`);

    layout.cards.forEach(({ node, item, descLines, col, row }) => {
      const cx  = bb.x + SIDE_PAD + col * (colW + COL_GAP);
      let   cy  = originY + layout.rowY[row] + CARD_PT;
      const idx = annotated.indexOf(node) + 1;

      // Index
      out.push(`<text x="${cx}" y="${cy + IDX_SIZE}" font-size="${IDX_SIZE}" font-weight="700" fill="#aaa">${idx}</text>`);
      cy += IDX_SIZE + IDX_GAP;

      // Type name
      out.push(`<text x="${cx}" y="${cy + TYPE_SIZE}" font-size="${TYPE_SIZE}" font-weight="600" fill="#1a1a1a">${esc(item?.label || '')}</text>`);
      cy += TYPE_SIZE + 4;

      // Short label
      if (node.comment) {
        out.push(`<text x="${cx}" y="${cy + LBL_SIZE}" font-size="${LBL_SIZE}" font-style="italic" fill="#777">${esc(node.comment)}</text>`);
        cy += LBL_SIZE + 6;
      } else {
        cy += 2;
      }

      // Description
      descLines.forEach(line => {
        out.push(`<text x="${cx}" y="${cy + DESC_SIZE}" font-size="${DESC_SIZE}" fill="#555">${esc(line)}</text>`);
        cy += DESC_LH;
      });
    });

    out.push('</g>');
    return layout.totalH + 40; // total section height
  }

  // ── PNG export ─────────────────────────────────────────────────────────────

  function exportPNG(items) {
    const nodes       = State.getNodes();
    const connections = State.getConnections();
    const bb          = getBoundingBox(nodes);

    const annotated = [...nodes]
      .filter(n => n.description)
      .sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);

    const DPR     = 2;
    const footY   = bb.maxNodesY + FOOT_GAP;

    // Estimate footnote height for canvas sizing (done in two passes: first measure, then draw)
    // Create a temporary canvas to measure text
    const tmpCtx  = document.createElement('canvas').getContext('2d');
    tmpCtx.font   = `${DESC_SIZE}px Inter, sans-serif`;
    const numCols = Math.min(NUM_COLS, annotated.length);
    const colW    = (bb.w - SIDE_PAD * 2 - COL_GAP * (numCols - 1)) / numCols;
    const wrap    = text => wrapCanvas(tmpCtx, text, colW - 4);
    const layout  = annotated.length ? buildFootnoteLayout(annotated, items, colW, wrap) : null;
    const footH   = layout ? layout.totalH + 60 : 0;

    const canvasW = bb.w;
    const canvasH = annotated.length ? (footY - bb.y) + footH : bb.h;

    const off     = document.createElement('canvas');
    off.width     = canvasW * DPR;
    off.height    = canvasH * DPR;
    const ctx     = off.getContext('2d');

    // transparent background — no fillRect

    ctx.save();
    ctx.scale(DPR, DPR);
    ctx.translate(-bb.x, -bb.y);

    Connections.drawAll(ctx, connections, nodes, null);
    Nodes.drawAll(ctx, nodes, items, [], null, null);

    if (annotated.length) {
      drawFootnotesCanvas(ctx, annotated, items, bb, footY);
    }

    // Logo
    ctx.font      = '11px Inter, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('tastbaar.studio', bb.x + canvasW - 12, bb.y + canvasH - 10);

    ctx.restore();

    triggerDownload(off.toDataURL('image/png'), 'storyboard_' + timestamp() + '.png');
  }

  // ── SVG export ─────────────────────────────────────────────────────────────

  function exportSVG(items) {
    const nodes       = State.getNodes();
    const connections = State.getConnections();
    const bb          = getBoundingBox(nodes);

    const annotated = [...nodes]
      .filter(n => n.description)
      .sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
    const indexMap  = new Map(annotated.map((n, i) => [n.id, i + 1]));

    const footY   = bb.maxNodesY + FOOT_GAP;

    // Pre-build footnotes to know total height
    const svgOut  = [];
    const footH   = buildSVGFootnotes(svgOut, annotated, items, bb, footY);
    const totalH  = annotated.length ? (footY - bb.y) + footH : bb.h;

    const out = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${bb.w}" height="${totalH}" viewBox="${bb.x} ${bb.y} ${bb.w} ${totalH}">`);
    out.push(`<style>text { font-family: Inter, sans-serif; }</style>`);
    // transparent background;

    // ── Connections ──
    out.push('<g id="connections">');
    connections.forEach(conn => {
      const fromNode = nodes.find(n => n.id === conn.fromNodeId);
      const toNode   = nodes.find(n => n.id === conn.toNodeId);
      if (!fromNode || !toNode) return;
      const fromPort     = Nodes.getPortPositions(fromNode).output;
      const toPort       = Nodes.getPortPositions(toNode).input;
      const { cp1, cp2 } = bezierControlPoints(fromPort, toPort);
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
      const totalTextH = lines.length * 18;
      const textStartY = y + (height - totalTextH) / 2 + 9;
      const descIndex  = indexMap.get(node.id) ?? null;

      out.push('<g>');
      out.push(`<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="white" stroke="#e4e4e0" stroke-width="1"/>`);
      out.push(`<rect x="${x}" y="${y}" width="4" height="${height}" fill="${color}"/>`);

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

      lines.forEach((line, i) => {
        out.push(`<text x="${x + 30}" y="${textStartY + i * 18}" font-size="13" fill="#1a1a1a" dominant-baseline="middle">${esc(line)}</text>`);
      });

      if (node.comment) {
        out.push(`<text x="${x + width / 2}" y="${y + height + 7}" font-size="11" font-style="italic" fill="#888" text-anchor="middle" dominant-baseline="hanging">${esc(node.comment)}</text>`);
      }

      if (descIndex != null) {
        const icX = x + width - 11, icY = y + 11;
        out.push(`<circle cx="${icX}" cy="${icY}" r="7" fill="#e0e0da"/>`);
        out.push(`<text x="${icX}" y="${icY + 0.5}" font-size="8" font-weight="700" fill="#666" text-anchor="middle" dominant-baseline="middle">${descIndex}</text>`);
      }

      out.push('</g>');
    });
    out.push('</g>');

    // Footnote section (pre-built above)
    out.push(...svgOut);

    // Logo
    out.push(`<text x="${bb.x + bb.w - 12}" y="${bb.y + totalH - 10}" font-size="11" fill="#aaa" text-anchor="end">tastbaar.studio</text>`);

    out.push('</svg>');

    const blob = new Blob([out.join('\n')], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    triggerDownload(url, 'storyboard_' + timestamp() + '.svg');
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return { exportPNG, exportSVG };
})();

window.Export = Export;
