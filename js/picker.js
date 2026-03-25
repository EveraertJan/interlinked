// picker.js — double-click node picker panel, tabs, search, keyboard nav

const Picker = (() => {
  const panel      = document.getElementById('picker-panel');
  const tabsEl     = document.getElementById('picker-tabs');
  const searchEl   = document.getElementById('picker-search');
  const listEl     = document.getElementById('picker-list');

  const COL_NAMES = ['Input Device', 'Input Effect', 'Manipulation', 'Output Effect', 'Output Device'];

  let columns       = null;  // raw JSON columns array
  let itemsFlat     = null;  // normalised items lookup from main.js
  let activeTab     = 0;
  let onPlace       = null;  // callback(itemId, colIndex, worldX, worldY)
  let placeWorld    = null;  // { x, y }
  let activeIndex   = -1;
  let filteredItems = [];    // flat ordered list of items currently visible
  let suggestedIds  = null;  // Set of item IDs to highlight as suggested (wire-drop mode)

  // ── Public init ────────────────────────────────────────────────────────────

  function init(columnsData, normalisedItems) {
    columns   = columnsData;
    itemsFlat = normalisedItems || null;
    renderTabs();
  }

  // ── Open / Close ───────────────────────────────────────────────────────────

  function open(worldX, worldY, screenX, screenY, placeCb, defaultTab, suggestedSet) {
    placeWorld   = { x: worldX, y: worldY };
    onPlace      = placeCb;
    suggestedIds = suggestedSet instanceof Set ? suggestedSet : null;

    // Switch to requested tab before rendering
    if (defaultTab !== undefined && defaultTab >= 0 && defaultTab <= 4) {
      activeTab = defaultTab;
    }

    // Position panel — flip if it would overflow viewport
    const PW = 800, PH = 520;
    let left = screenX - Math.round(PW / 2);
    let top  = screenY + 10;
    if (left + PW > window.innerWidth  - 10) left = window.innerWidth - PW - 10;
    if (top  + PH > window.innerHeight - 10) top  = screenY - PH - 10;
    left = Math.max(10, left);
    top  = Math.max(54, top);  // stay below toolbar

    panel.style.left = left + 'px';
    panel.style.top  = top  + 'px';
    panel.removeAttribute('hidden');

    searchEl.value = '';
    activeIndex = 0;
    renderTabs();
    renderList();
    // Focus search on next tick so the dblclick doesn't clear it
    setTimeout(() => searchEl.focus(), 10);
  }

  function close() {
    panel.setAttribute('hidden', '');
    searchEl.value = '';
    filteredItems  = [];
    suggestedIds   = null;
  }

  function isOpen() {
    return !panel.hasAttribute('hidden');
  }

  // ── Tabs ───────────────────────────────────────────────────────────────────

  function renderTabs() {
    tabsEl.innerHTML = '';
    COL_NAMES.forEach((name, i) => {
      const btn = document.createElement('button');
      btn.className   = 'picker-tab' + (i === activeTab ? ' active' : '');
      btn.textContent = name;
      btn.addEventListener('click', () => selectTab(i));
      tabsEl.appendChild(btn);
    });
  }

  function selectTab(i) {
    activeTab   = i;
    activeIndex = 0;
    renderTabs();
    renderList();
  }

  // ── List ───────────────────────────────────────────────────────────────────

  function getColumnItems(colIndex) {
    if (!columns || !columns[colIndex]) return [];
    return columns[colIndex].items.map(raw => ({
      ...raw,
      label:    raw.name,
      colIndex,
      colName:  COL_NAMES[colIndex],
    }));
  }

  function renderList() {
    listEl.innerHTML = '';
    filteredItems    = [];

    const query     = searchEl.value.trim().toLowerCase();
    const colItems  = getColumnItems(activeTab);
    const recent    = State.getRecentlyUsed(activeTab);

    const rows = []; // { type: 'section'|'divider'|'item', item?, label? }

    if (!query) {
      colItems.forEach(it => rows.push({ type: 'item', item: it }));
    } else {
      colItems
        .filter(it => it.name.toLowerCase().includes(query))
        .forEach(it => rows.push({ type: 'item', item: it }));
    }

    filteredItems = rows.filter(r => r.type === 'item').map(r => r.item);

    rows.forEach(row => {
      if (row.type === 'section') {
        const el = document.createElement('div');
        el.className   = 'picker-section-label';
        el.textContent = row.label;
        listEl.appendChild(el);
        return;
      }
      if (row.type === 'divider') {
        listEl.appendChild(Object.assign(document.createElement('div'), { className: 'picker-divider' }));
        return;
      }

      const it      = row.item;
      const sense   = (itemsFlat && itemsFlat[it.id]) ? itemsFlat[it.id].sense : 'neutral';
      const color   = window.Nodes ? Nodes.getSenseColor(sense) : '#b0b0b0';
      const agency  = normalizeAgency(it.agency);

      const isSuggested = row.suggested || (suggestedIds && suggestedIds.has(it.id));

      const rowEl = document.createElement('div');
      rowEl.className     = 'picker-item' + (isSuggested ? ' suggested' : '');
      rowEl.dataset.itemId = it.id;

      const senseDot = document.createElement('div');
      senseDot.className        = 'picker-item-sense-dot';
      senseDot.style.background = color;

      const agencyEl = document.createElement('div');
      agencyEl.className = 'picker-item-agency';
      agencyEl.innerHTML = makeAgencySVG(agency, color);

      const labelEl = document.createElement('div');
      labelEl.className   = 'picker-item-label';
      labelEl.textContent = it.name;

      // rowEl.appendChild(senseDot);
      rowEl.appendChild(agencyEl);
      rowEl.appendChild(labelEl);
      rowEl.addEventListener('click', () => placeItem(it));
      listEl.appendChild(rowEl);
    });

    updateActiveItem();
  }

  function normalizeAgency(agency) {
    if (agency === 'intentional' || agency === 'controlled')   return 'active';
    if (agency === 'accidental'  || agency === 'uncontrolled') return 'passive';
    return 'semi';
  }

  function makeAgencySVG(agency, color) {
    const cx = 6, cy = 6, r = 5;
    if (agency === 'active') {
      return `<svg width="12" height="12"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/></svg>`;
    }
    if (agency === 'passive') {
      return `<svg width="12" height="12"><circle cx="${cx}" cy="${cy}" r="${r - 0.75}" fill="none" stroke="${color}" stroke-width="1.5"/></svg>`;
    }
    // semi — right half filled
    return `<svg width="12" height="12">
      <path d="M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} Z" fill="${color}"/>
      <circle cx="${cx}" cy="${cy}" r="${r - 0.75}" fill="none" stroke="${color}" stroke-width="1.5"/>
    </svg>`;
  }

  function updateActiveItem() {
    const rows = listEl.querySelectorAll('.picker-item');
    rows.forEach((row, i) => {
      const active = i === activeIndex;
      row.classList.toggle('active', active);
      if (active) row.scrollIntoView({ block: 'nearest' });
    });
  }

  function placeItem(item) {
    if (!item || !onPlace) return;
    State.addRecentlyUsed(item.colIndex, item.id);
    onPlace(item.id, item.colIndex, placeWorld.x, placeWorld.y);
    close();
  }

  // ── Keyboard navigation (from search input) ────────────────────────────────

  searchEl.addEventListener('input', () => {
    activeIndex = 0;
    renderList();
  });

  searchEl.addEventListener('keydown', e => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 4, filteredItems.length - 1);
        updateActiveItem();
        break;
      case 'ArrowUp':
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 4, 0);
        updateActiveItem();
        break;
      case 'ArrowRight':
        e.preventDefault();
        activeIndex = Math.min(activeIndex + 1, filteredItems.length - 1);
        updateActiveItem();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
        updateActiveItem();
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[activeIndex]) placeItem(filteredItems[activeIndex]);
        break;
      case 'Tab':
        e.preventDefault();
        selectTab(e.shiftKey ? (activeTab + 4) % 5 : (activeTab + 1) % 5);
        break;
    }
  });

  // Close on outside click / tap
  document.addEventListener('mousedown', e => {
    if (isOpen() && !panel.contains(e.target)) close();
  });
  document.addEventListener('touchstart', e => {
    if (isOpen() && !panel.contains(e.target)) close();
  }, { passive: true });

  return { init, open, close, isOpen };
})();

window.Picker = Picker;
