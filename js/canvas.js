// canvas.js — render loop, pan/zoom, coordinate transforms

const Canvas = (() => {
  const el = document.getElementById('graph-canvas');
  const ctx = el.getContext('2d');
  let dpr = window.devicePixelRatio || 1;
  let rafId = null;
  let dragLoopActive = false;

  // External draw callbacks (set by main.js after all modules loaded)
  let drawCallback = null;

  function setDrawCallback(fn) { drawCallback = fn; }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    el.width = window.innerWidth * dpr;
    el.height = window.innerHeight * dpr;
    el.style.width = window.innerWidth + 'px';
    el.style.height = window.innerHeight + 'px';
    render();
  }

  function screenToWorld(sx, sy) {
    const vp = State.getViewport();
    return {
      x: (sx - vp.x) / vp.zoom,
      y: (sy - vp.y) / vp.zoom,
    };
  }

  function worldToScreen(wx, wy) {
    const vp = State.getViewport();
    return {
      x: wx * vp.zoom + vp.x,
      y: wy * vp.zoom + vp.y,
    };
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function drawGrid() {
    const vp = State.getViewport();
    const spacing = 24 * vp.zoom;
    const dotR = Math.max(0.6, 1.0 * vp.zoom);

    const offsetX = ((vp.x % spacing) + spacing) % spacing;
    const offsetY = ((vp.y % spacing) + spacing) % spacing;

    ctx.save();
    ctx.fillStyle = '#cccccc';
    ctx.globalAlpha = 0.5;
    for (let x = offsetX; x < el.width / dpr; x += spacing) {
      for (let y = offsetY; y < el.height / dpr; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawZoomIndicator() {
    const vp = State.getViewport();
    const text = Math.round(vp.zoom * 100) + '%';
    ctx.save();
    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(text, el.width / dpr - 12, el.height / dpr - 12);
    ctx.restore();
  }

  function render() {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, el.width / dpr, el.height / dpr);

    // Draw dot grid (screen space)
    drawGrid();

    // Apply world transform
    const vp = State.getViewport();
    ctx.save();
    ctx.translate(vp.x, vp.y);
    ctx.scale(vp.zoom, vp.zoom);

    // Draw world content via callback
    if (drawCallback) drawCallback(ctx);

    ctx.restore();

    // Draw screen-space overlays
    drawZoomIndicator();

    ctx.restore();
  }

  function startDragLoop() {
    dragLoopActive = true;
    function loop() {
      if (!dragLoopActive) return;
      render();
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  }

  function stopDragLoop() {
    dragLoopActive = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    render();
  }

  // Zoom on wheel
  function onWheel(e) {
    e.preventDefault();
    const vp = State.getViewport();
    const factor = 1 - clamp(e.deltaY * 0.001, -0.2, 0.2);
    const wx = (e.clientX - vp.x) / vp.zoom;
    const wy = (e.clientY - vp.y) / vp.zoom;
    const newZoom = clamp(vp.zoom * factor, 0.2, 3);
    State.setViewport({
      x: e.clientX - wx * newZoom,
      y: e.clientY - wy * newZoom,
      zoom: newZoom,
    });
    render();
  }

  el.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('resize', resize);
  State.on('change', render);
  State.on('viewport', render);

  // Initial sizing
  resize();

  return {
    el,
    ctx,
    screenToWorld,
    worldToScreen,
    render,
    startDragLoop,
    stopDragLoop,
    setDrawCallback,
    getDpr: () => dpr,
  };
})();

window.Canvas = Canvas;
