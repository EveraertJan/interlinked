# Interaction Storyboard Tool

A browser-based node graph canvas for designing interaction chains across five columns: **Input Device → Input Effect → Manipulation → Output Effect → Output Device**.

Built for [tastbaar.studio](https://tastbaar.studio) to prototype and communicate interaction design concepts.

---

## What it does

Place nodes from a curated library of interaction primitives and connect them into chains that describe how a system senses, processes, and responds. Each node is coloured by sense modality (sight, hearing, touch, proprioception, etc.) and marked with an agency indicator (intentional / accidental / both).

Connections follow column adjacency rules — you can only wire nodes in the correct left-to-right order, with Manipulation nodes allowed to chain into each other for multi-step processing.

---

## Features

- **Infinite canvas** — pan (space+drag or middle-click), zoom (scroll wheel, 0.2×–3×), dot-grid background
- **Node picker** — double-click anywhere to open a floating picker; 5 column tabs, live search, recently-used items, full keyboard navigation
- **Smart connections** — drag from output port to input port; preferred targets highlighted based on `connects_to` data; column adjacency enforced; Manipulation self-loops rendered as dashed arcs
- **Multi-select** — click, drag-select rectangle, or ⌘A; move groups together
- **Auto-layout** — arranges nodes into five tidy lanes with a 300ms animated transition
- **Undo / Redo** — 50-step history covering all actions (⌘Z / ⌘⇧Z)
- **Auto-save** — canvas state persisted to `localStorage` on every change (debounced 1 s); restored on reload
- **Export** — SVG (grouped, with logo) and PNG (2× pixel density, cropped to content)
- **Save / Load** — board state as JSON for sharing or archiving

---

## Usage

Open `index.html` directly in a browser (no build step, no server required — but note that `interaction_graph.json` is loaded via `fetch`, so you may need a local HTTP server for Chrome):

```bash
# Quick local server (Python 3)
python3 -m http.server 8080
# then open http://localhost:8080
```

| Action | How |
|---|---|
| Add node | Double-click empty canvas |
| Connect nodes | Drag from right port → left port of next column |
| Select | Click node or drag selection rectangle |
| Move | Drag selected node(s) |
| Delete | Select + Backspace / Delete, or right-click → Delete node |
| Pan | Space + drag, or middle-click drag |
| Zoom | Scroll wheel |
| Undo / Redo | ⌘Z / ⌘⇧Z |
| Select all | ⌘A |

---

## Stack

- Vanilla JS (ES2020) — no framework, no build tooling
- HTML Canvas 2D API for rendering
- `localStorage` for persistence
- Data: `interaction_graph.json` (5 columns, ~150 items, with `connects_to` / `output_connects_to` relationships)

## File structure

```
index.html
interaction_graph.json
css/
  style.css
js/
  state.js        — undo/redo stack, localStorage, event emitter
  canvas.js       — render loop, pan/zoom, coordinate transforms
  nodes.js        — node creation, drawing, hit testing
  connections.js  — bezier curves, port detection, highlight logic
  picker.js       — floating picker panel, tabs, search, keyboard nav
  export.js       — SVG + PNG export
  main.js         — app init, data loading, all event handling
```

---

## Data format

Saved boards use a simple JSON envelope:

```json
{
  "nodes": [
    { "id": "…", "itemId": "id_camera", "colIndex": 0, "x": 120, "y": 80, "width": 200, "height": 44 }
  ],
  "connections": [
    { "id": "…", "fromNodeId": "…", "toNodeId": "…", "isLoop": false }
  ],
  "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```
