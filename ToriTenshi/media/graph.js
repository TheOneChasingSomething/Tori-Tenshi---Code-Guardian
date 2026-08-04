/* Interactive trust graph rendered on a canvas with a small force-directed
 * layout. No external dependency: this runs inside the sandboxed webview under
 * a strict CSP. Communicates with the extension via the VS Code message API.
 */
(function () {
  const vscode = acquireVsCodeApi();
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  // Trust-state palette (semantic, readable on dark and light themes).
  const STATE_COLOR = {
    'unreviewed': '#9aa0a6',
    'in-progress': '#4aa3ff',
    'validated': '#3fb950',
    'at-risk': '#f0883e',
    'documented': '#a371f7',
  };
  const STATE_LABEL = {
    'unreviewed': 'Unreviewed',
    'in-progress': 'In progress',
    'validated': 'Validated',
    'at-risk': 'At risk',
    'documented': 'Documented',
  };

  let nodes = [];
  let edges = [];
  let layout = 'force'; // 'force' | 'layered'
  const hiddenStates = new Set();
  let query = '';
  let selected = null;
  let dragging = null;
  let dpr = window.devicePixelRatio || 1;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }
  window.addEventListener('resize', resize);

  function setData(data) {
    const prev = new Map(nodes.map((n) => [n.id, n]));
    nodes = data.nodes.map((n) => {
      const old = prev.get(n.id);
      return Object.assign({ x: old ? old.x : centerX() + rand(120), y: old ? old.y : centerY() + rand(120), vx: 0, vy: 0 }, n);
    });
    edges = data.edges;
    if (selected) {
      selected = nodes.find((n) => n.key === selected.key) || null;
      renderDetails();
    }
  }

  const rand = (r) => (Math.random() - 0.5) * r;
  const centerX = () => canvas.clientWidth / 2;
  const centerY = () => canvas.clientHeight / 2;
  const visible = (n) => !hiddenStates.has(n.state) && (!query || n.label.toLowerCase().includes(query));

  // ---- Force simulation ----------------------------------------------------
  function step() {
    const vis = nodes.filter(visible);
    const k = 0.02;      // spring
    const rep = 5200;    // repulsion
    const idealLen = 90;

    for (const n of vis) { n.fx = 0; n.fy = 0; }

    // Repulsion (O(n^2), fine for review-sized graphs).
    for (let i = 0; i < vis.length; i++) {
      for (let j = i + 1; j < vis.length; j++) {
        const a = vis[i], b = vis[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy || 0.01;
        const f = rep / d2;
        const d = Math.sqrt(d2);
        const ux = dx / d, uy = dy / d;
        a.fx += ux * f; a.fy += uy * f;
        b.fx -= ux * f; b.fy -= uy * f;
      }
    }
    // Springs along edges.
    const byId = new Map(vis.map((n) => [n.id, n]));
    for (const e of edges) {
      const a = byId.get(e.from), b = byId.get(e.to);
      if (!a || !b) continue;
      let dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (d - idealLen) * k;
      const ux = dx / d, uy = dy / d;
      a.fx += ux * f; a.fy += uy * f;
      b.fx -= ux * f; b.fy -= uy * f;
    }
    // Layout-specific pull.
    for (const n of vis) {
      if (layout === 'layered') {
        const targetY = 60 + n.depth * 110;
        n.fy += (targetY - n.y) * 0.08;
        n.fx += (centerX() - n.x) * 0.002;
      } else {
        n.fx += (centerX() - n.x) * 0.006;
        n.fy += (centerY() - n.y) * 0.006;
      }
    }
    // Integrate.
    for (const n of vis) {
      if (n === dragging) continue;
      n.vx = (n.vx + n.fx) * 0.85;
      n.vy = (n.vy + n.fy) * 0.85;
      n.x += Math.max(-8, Math.min(8, n.vx));
      n.y += Math.max(-8, Math.min(8, n.vy));
    }
  }

  // ---- Render --------------------------------------------------------------
  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    const fg = getComputedStyle(document.body).getPropertyValue('--vscode-foreground') || '#ccc';

    // Edges.
    ctx.strokeStyle = withAlpha(fg, 0.35);
    ctx.lineWidth = 1;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      const a = byId.get(e.from), b = byId.get(e.to);
      if (!a || !b || !visible(a) || !visible(b)) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      drawArrow(a, b);
    }
    // Nodes.
    for (const n of nodes) {
      if (!visible(n)) continue;
      const r = 9;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = STATE_COLOR[n.state] || '#888';
      ctx.fill();
      if (n === selected) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = fg;
        ctx.stroke();
      }
      ctx.fillStyle = fg;
      ctx.font = '11px var(--vscode-font-family)';
      ctx.textAlign = 'center';
      ctx.fillText(truncate(n.label, 22), n.x, n.y + r + 12);
    }
  }

  function drawArrow(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    const hx = b.x - ux * 11, hy = b.y - uy * 11;
    const size = 5;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - ux * size - uy * size, hy - uy * size + ux * size);
    ctx.lineTo(hx - ux * size + uy * size, hy - uy * size - ux * size);
    ctx.closePath();
    ctx.fill();
  }

  function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function withAlpha(color, a) {
    const c = color.trim();
    if (c.startsWith('#') && c.length === 7) {
      const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    }
    return c;
  }

  function loop() { step(); draw(); requestAnimationFrame(loop); }

  // ---- Interaction ---------------------------------------------------------
  function nodeAt(x, y) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (visible(n) && Math.hypot(n.x - x, n.y - y) <= 11) return n;
    }
    return null;
  }
  function pos(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
  canvas.addEventListener('mousedown', (ev) => {
    const p = pos(ev);
    const n = nodeAt(p.x, p.y);
    if (n) { dragging = n; selected = n; renderDetails(); }
  });
  window.addEventListener('mousemove', (ev) => {
    if (!dragging) return;
    const p = pos(ev);
    dragging.x = p.x; dragging.y = p.y; dragging.vx = 0; dragging.vy = 0;
  });
  window.addEventListener('mouseup', () => { dragging = null; });
  canvas.addEventListener('dblclick', (ev) => {
    const p = pos(ev);
    const n = nodeAt(p.x, p.y);
    if (n && n.file) vscode.postMessage({ type: 'open', key: n.key });
  });

  // ---- Details panel + state change ---------------------------------------
  const details = document.getElementById('details');
  function renderDetails() {
    if (!selected) { details.classList.remove('visible'); return; }
    details.classList.add('visible');
    const options = Object.keys(STATE_LABEL)
      .map((s) => `<option value="${s}" ${s === selected.state ? 'selected' : ''}>${STATE_LABEL[s]}</option>`)
      .join('');
    details.innerHTML =
      `<h3>${escapeHtml(selected.label)}</h3>` +
      `<div class="meta">${escapeHtml(selected.kind)} · ${selected.file ? escapeHtml(selected.file) : 'no file'}</div>` +
      `<div class="row"><span>State:</span> <select id="stateSel">${options}</select></div>` +
      (selected.file ? `<div class="row" style="margin-top:8px"><button id="openBtn">Open in editor</button></div>` : '');
    const sel = document.getElementById('stateSel');
    sel.addEventListener('change', () => vscode.postMessage({ type: 'setState', key: selected.key, state: sel.value }));
    const openBtn = document.getElementById('openBtn');
    if (openBtn) openBtn.addEventListener('click', () => vscode.postMessage({ type: 'open', key: selected.key }));
  }
  function escapeHtml(s) { return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---- Toolbar -------------------------------------------------------------
  document.getElementById('fit').addEventListener('click', () => {
    for (const n of nodes) { n.x = centerX() + rand(200); n.y = centerY() + rand(200); n.vx = n.vy = 0; }
  });
  document.getElementById('layout').addEventListener('change', (e) => { layout = e.target.value; });
  document.getElementById('search').addEventListener('input', (e) => { query = e.target.value.toLowerCase(); });
  document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'requestRefresh' }));

  const filters = document.getElementById('filters');
  Object.keys(STATE_LABEL).forEach((s) => {
    const label = document.createElement('label');
    label.className = 'filter';
    label.innerHTML = `<input type="checkbox" checked data-state="${s}"><span class="swatch" style="background:${STATE_COLOR[s]}"></span>${STATE_LABEL[s]}`;
    label.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) hiddenStates.delete(s); else hiddenStates.add(s);
    });
    filters.appendChild(label);
  });

  // ---- Wire up -------------------------------------------------------------
  window.addEventListener('message', (ev) => {
    const msg = ev.data;
    if (msg.type === 'data') setData(msg.data);
  });

  resize();
  loop();
  vscode.postMessage({ type: 'ready' });
})();
