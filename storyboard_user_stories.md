# Interaction Storyboard Tool — User Stories

## Overview
A browser-based node graph canvas for storyboarding interaction design chains.
Data source: `interaction_graph.json` (5 columns: Input Device → Input Effect → Manipulation → Output Effect → Output Device).

---

## Epic 1 — Canvas

### US-01 — Empty canvas
**As a** designer
**I want** an infinite pannable canvas with a subtle grid
**So that** I have space to build interaction chains

**Acceptance criteria:**
- Canvas fills the viewport
- Middle-click or space+drag pans
- Scroll wheel zooms (min 0.2x, max 3x)
- Subtle dot-grid background that moves with pan/zoom
- Current zoom level shown in a corner indicator

---

### US-02 — Node creation via double-click
**As a** designer
**I want** to double-click the canvas to open a node picker
**So that** I can add nodes to the canvas quickly

**Acceptance criteria:**
- Double-clicking empty canvas opens a floating picker panel at cursor position
- Picker has 5 tabs, one per column: Input Device / Input Effect / Manipulation / Output Effect / Output Device
- Each tab lists all items from that column in interaction_graph.json
- Items are searchable via a text input at the top of the picker
- Clicking an item closes the picker and places a node at the cursor position
- Pressing Escape closes the picker without creating a node
- Picker stays within viewport bounds (flips side if too close to edge)

---

### US-03 — Node appearance
**As a** designer
**I want** nodes to be visually distinct by column and sense
**So that** I can read the graph at a glance

**Acceptance criteria:**
- Node is a rectangle with square corners
- Node width: 200px, height auto-fits label (no truncation)
- Left side has a 4px colour bar indicating its sense (sight=amber, hearing=blue, touch=coral, smell=green, taste=violet, proprioception=orange, neural=teal, spatial=indigo, neutral=grey)
- Agency dot (filled/empty/half-filled) before the label, coloured by sense
- Node label in Inter, 13px
- Column name shown in small caps below the colour bar
- Selected node has a 2px black outline
- Nodes can be dragged freely on the canvas

---

### US-04 — Node deletion
**As a** designer
**I want** to delete nodes from the canvas
**So that** I can correct mistakes

**Acceptance criteria:**
- Selecting a node and pressing Backspace or Delete removes it and all its connections
- Right-clicking a node shows a context menu with "Delete node"
- Deleting a node with connections asks for confirmation ("Remove node and N connections?")

---

## Epic 2 — Connections

### US-05 — Creating connections by dragging
**As a** designer
**I want** to drag from a node's output port to create a connection
**So that** I can build interaction chains

**Acceptance criteria:**
- Each node has a small circular port on its right edge (output) and left edge (input)
- Hovering a port highlights it
- Dragging from an output port shows a live bezier curve following the cursor
- Dropping onto a valid input port creates a connection
- Dropping on empty canvas cancels the attempt
- A node can only connect to nodes in the immediately adjacent column (Input Device to Input Effect only, not Input Device to Manipulation)
- Multiple connections are allowed from/to the same node (one-to-many and many-to-one)

---

### US-06 — Preferred connection highlighting
**As a** designer
**I want** relevant targets highlighted when I drag a connection
**So that** I know which nodes are preferred matches

**Acceptance criteria:**
- While dragging from a node's output port, nodes in the next column become visible
- Nodes listed in the source node's connects_to array render at opacity 1.0 (preferred)
- All other nodes in that column render at opacity 0.5 (possible but not preferred)
- Nodes in all other columns dim to opacity 0.2 (not connectable)
- Manipulation nodes also highlight their output_connects_to targets when dragging forward

---

### US-07 — Connection appearance
**As a** designer
**I want** connections to be clearly visible but not dominant
**So that** the nodes remain the primary focus

**Acceptance criteria:**
- Connections are smooth cubic bezier curves
- Default stroke: #a0aab8, width 1.5px, opacity 0.6
- Selected connection: stroke #333, width 2px, opacity 1
- Small filled dot (r=3) at both endpoints
- Clicking a connection selects it; pressing Delete removes it
- Connections re-route when nodes are dragged

---

### US-08 — Manipulation column self-loops
**As a** designer
**I want** to connect manipulation nodes to other manipulation nodes
**So that** I can represent chained processing (e.g. Cached to Decay)

**Acceptance criteria:**
- Within the Manipulation column only, output ports can connect to other manipulation node input ports
- Self-loop connections render as a small arc on the right side, visually distinct (dashed stroke)
- Preferred targets from connects_to get opacity 1, others 0.5

---

## Epic 3 — Picker UX

### US-09 — Picker panel layout
**As a** designer
**I want** the picker to feel like a node palette
**So that** I can quickly scan and select nodes

**Acceptance criteria:**
- Picker panel: 320px wide, max 480px tall, scrollable
- 5 tabs at the top (one per column)
- Active tab underlined, not filled
- Each item row shows: sense colour dot + agency dot + label
- Hovering an item shows a faint highlight row
- Recently used items appear at the top of each tab, separated by a hairline
- Recently used items persist in localStorage

---

### US-10 — Picker keyboard navigation
**As a** designer
**I want** to navigate the picker with the keyboard
**So that** I can work without switching to mouse

**Acceptance criteria:**
- Arrow keys move selection up/down
- Tab / Shift+Tab cycles between column tabs
- Enter places the selected item as a node
- Typing immediately focuses the search input
- Search filters items in real time (case-insensitive, substring match)

---

## Epic 4 — Canvas management

### US-11 — Select, move, and multi-select
**As a** designer
**I want** to select and move single or multiple nodes
**So that** I can organise the canvas

**Acceptance criteria:**
- Click a node to select it (deselects others)
- Drag on empty canvas draws a selection rectangle
- All nodes within the rectangle are selected after mouse release
- Dragging any selected node moves all selected nodes together
- Cmd/Ctrl+A selects all nodes
- Selected nodes show a 2px black outline

---

### US-12 — Auto-layout
**As a** designer
**I want** an auto-layout button that arranges nodes into columns
**So that** I can tidy a messy canvas

**Acceptance criteria:**
- "Auto-layout" button in toolbar
- Nodes arranged into 5 vertical lanes, one per column
- Connections re-route after layout
- Layout animates smoothly (300ms ease)
- Undo available after auto-layout

---

### US-13 — Undo / Redo
**As a** designer
**I want** undo and redo
**So that** I can recover from mistakes

**Acceptance criteria:**
- Cmd/Ctrl+Z undoes last action
- Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y redoes
- History depth: minimum 50 steps
- Covers: node creation, node deletion, connection creation, connection deletion, node move, auto-layout

---

## Epic 5 — Export

### US-14 — Export as SVG
**As a** designer
**I want** to export the current canvas as SVG
**So that** I can use it in presentations or documents

**Acceptance criteria:**
- "Export SVG" button in toolbar
- SVG contains all nodes and connections on canvas
- Same visual style as the existing generate_svg.js output
- Nodes and connections are grouped (g id="nodes", g id="connections")
- Filename: storyboard_[timestamp].svg
- Includes tastbaar.studio logo bottom-right

---

### US-15 — Export as PNG
**As a** designer
**I want** to export the current canvas as PNG
**So that** I can share it easily

**Acceptance criteria:**
- "Export PNG" button in toolbar
- Rendered at 2x pixel density
- White background
- Filename: storyboard_[timestamp].png
- Canvas cropped to bounding box of all nodes with 60px padding

---

## Epic 6 — Persistence

### US-16 — Auto-save to localStorage
**As a** designer
**I want** my work saved automatically
**So that** I don't lose progress if I close the tab

**Acceptance criteria:**
- Canvas state saved to localStorage on every change (debounced 1s)
- Last saved state restored on page load
- "Last saved" timestamp shown in toolbar
- "New board" button clears canvas with confirmation

---

### US-17 — Save and load JSON
**As a** designer
**I want** to save and load board states as JSON files
**So that** I can share work with others

**Acceptance criteria:**
- "Save board" exports state as storyboard_[timestamp].json
- "Load board" opens a file picker and loads a previously saved JSON
- Loaded board replaces current canvas (with confirmation if canvas is not empty)
- JSON format: { nodes: [...], connections: [...], viewport: { x, y, zoom } }

---

## Technical notes for Claude Code

### Stack
- Vanilla JS + HTML Canvas — no framework required
- All node/connection data loaded from interaction_graph.json at startup
- No backend — fully client-side

### Key data structures

Node:
```js
{
  id: string,         // unique uuid
  itemId: string,     // references item.id in JSON (e.g. "id_camera")
  colIndex: number,   // 0-4
  x: number,
  y: number,
  width: number,
  height: number,
}
```

Connection:
```js
{
  id: string,
  fromNodeId: string,
  toNodeId: string,
  isLoop: boolean,    // true for manipulation self-loops
}
```

### Sense colour map
```js
const SENSES = {
  sight:          "#c8a828",
  hearing:        "#4898c0",
  touch:          "#c85060",
  smell:          "#48a858",
  taste:          "#8050c8",
  proprioception: "#c87030",
  neural:         "#30a888",
  spatial:        "#6070c0",
  neutral:        "#b0b0b0",
}
```

### Suggested file structure
```
/
├── index.html
├── interaction_graph.json
├── js/
│   ├── main.js          — app init, event loop
│   ├── canvas.js        — pan, zoom, render loop
│   ├── nodes.js         — node creation, drag, render
│   ├── connections.js   — port detection, bezier draw, drag
│   ├── picker.js        — double-click panel, tabs, search
│   ├── export.js        — SVG + PNG export
│   └── state.js         — undo/redo stack, localStorage
└── css/
    └── style.css
```

### Column adjacency rules
- Column 0 (Input Device) connects to Column 1 (Input Effect) only
- Column 1 (Input Effect) connects to Column 2 (Manipulation) only
- Column 2 (Manipulation) connects to Column 2 (self-loops) and Column 3 (Output Effect)
- Column 3 (Output Effect) connects to Column 4 (Output Device) only
- Column 4 (Output Device) has no outgoing connections

### Preferred connection logic
When dragging from a node, look up its itemId in the JSON data.
If the item has a connects_to array, those target item ids are "preferred".
If the item has an output_connects_to array (manipulation column), those are also "preferred" when dragging forward.
All other nodes in the valid adjacent column are "possible" (opacity 0.5).
