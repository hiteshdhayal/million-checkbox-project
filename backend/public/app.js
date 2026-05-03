'use strict';

// ─── Constants ───────────────────────────────────────────────────────────────
const TOTAL_CHECKBOXES = 1_000_000;
const CELL_SIZE        = 22;
const CELL_GAP         = 2;
const CELL_TOTAL       = CELL_SIZE + CELL_GAP;  // 24px
const BUFFER_ROWS      = 3;
const PING_INTERVAL_MS = 5000;
const TICKER_MAX       = 5;

// Bit-count lookup table for efficient popcount
const POPCOUNT_TABLE = new Uint8Array(256);
for (let i = 1; i < 256; i++) {
  POPCOUNT_TABLE[i] = POPCOUNT_TABLE[i >> 1] + (i & 1);
}

// ─── State ───────────────────────────────────────────────────────────────────
let stateArray    = new Uint8Array(Math.ceil(TOTAL_CHECKBOXES / 8));
let checkedCount  = 0;
let user          = null;
let ws            = null;
let columns       = 1;
let totalRows     = 1;
let renderedRows  = new Map();   // rowIndex -> { el, startIndex }
let tickerQueue   = [];          // { index, value, ts }
let pingTs        = 0;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const gridScroll     = document.getElementById('grid-scroll');
const gridSpacer     = document.getElementById('grid-spacer');
const gridRows       = document.getElementById('grid-rows');
const loadingOverlay = document.getElementById('loading-overlay');
const loaderFill     = document.getElementById('loader-fill');
const loaderText     = document.getElementById('loader-text');
const checkedCountEl = document.getElementById('checked-count');
const userCountEl    = document.getElementById('user-count');
const connBadge      = document.getElementById('conn-badge');
const connLabel      = document.getElementById('conn-label');
const authSection    = document.getElementById('auth-section');
const tickerEntries  = document.getElementById('ticker-entries');
const progressLabel  = document.getElementById('progress-label');
const progressFill   = document.getElementById('progress-fill');
const pingVal        = document.getElementById('ping-val');
const badgeWs        = document.getElementById('badge-ws');
const badgeRedis     = document.getElementById('badge-redis');
const badgeOidc      = document.getElementById('badge-oidc');
const toastContainer = document.getElementById('toast-container');

// ─── Bit helpers ─────────────────────────────────────────────────────────────
function getBit(index) {
  const byte  = stateArray[index >> 3];
  const shift = 7 - (index & 7);
  return (byte >> shift) & 1;
}

function setBit(index, value) {
  const byteIdx = index >> 3;
  const shift   = 7 - (index & 7);
  if (value) {
    stateArray[byteIdx] |=  (1 << shift);
  } else {
    stateArray[byteIdx] &= ~(1 << shift);
  }
}

function countAllBits(arr) {
  let n = 0;
  for (let i = 0; i < arr.length; i++) n += POPCOUNT_TABLE[arr[i]];
  return n;
}

// ─── Stats UI ────────────────────────────────────────────────────────────────
function updateStats() {
  checkedCountEl.textContent = checkedCount.toLocaleString();
  const pct = ((checkedCount / TOTAL_CHECKBOXES) * 100).toFixed(2);
  progressLabel.textContent  = `${checkedCount.toLocaleString()} / 1,000,000 checked (${pct}%)`;
  progressFill.style.width   = pct + '%';
}

// ─── Toast ───────────────────────────────────────────────────────────────────
const activeToasts = [];
function showToast(msg) {
  while (activeToasts.length >= 3) {
    removeToast(activeToasts[0]);
  }
  const el = document.createElement('div');
  el.className   = 'toast-item';
  el.textContent = msg;
  toastContainer.appendChild(el);
  activeToasts.push(el);

  setTimeout(() => removeToast(el), 3000);
}

function removeToast(el) {
  const idx = activeToasts.indexOf(el);
  if (idx !== -1) activeToasts.splice(idx, 1);
  if (!el.parentNode) return;
  el.classList.add('removing');
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

// ─── Ticker ──────────────────────────────────────────────────────────────────
function addToTicker(index, value) {
  tickerQueue.unshift({ index, value, ts: Date.now() });
  if (tickerQueue.length > TICKER_MAX) tickerQueue.length = TICKER_MAX;
  renderTicker();
}

function renderTicker() {
  tickerEntries.innerHTML = '';
  if (tickerQueue.length === 0) {
    tickerEntries.innerHTML = '<span class="ticker-entry muted">— awaiting events —</span>';
    return;
  }
  // Show last 3 entries
  tickerQueue.slice(0, 3).forEach(({ index, value, ts }) => {
    const el  = document.createElement('span');
    el.className = 'ticker-entry';
    const ago = ((Date.now() - ts) / 1000).toFixed(1);
    const stateSpan = value
      ? `<span class="t-on">ON</span>`
      : `<span class="t-off">OFF</span>`;
    el.innerHTML = `#${String(index).padStart(7, '0')} · ${stateSpan} · ${ago}s ago`;
    tickerEntries.appendChild(el);
  });
}

// Update ticker timestamps every second
setInterval(renderTicker, 1000);

// ─── Auth ────────────────────────────────────────────────────────────────────
async function fetchUser() {
  try {
    const res = await fetch('/api/me');
    if (res.ok) {
      user = await res.json();
      badgeOidc.classList.add('active');
    }
  } catch (e) { /* offline */ }
  renderAuth();
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function renderAuth() {
  if (user) {
    authSection.innerHTML = `
      <div class="user-avatar">
        ${user.picture
          ? `<img src="${user.picture}" alt="${user.name}">`
          : getInitials(user.name)}
      </div>
      <span class="user-name-text">${user.name || user.email}</span>
      <a href="/auth/logout" class="logout-btn">ログアウト&nbsp;/&nbsp;LOGOUT</a>
    `;
  } else {
    authSection.innerHTML = `
      <a href="/auth/login" class="auth-btn">ログイン&nbsp;/&nbsp;LOGIN</a>
    `;
  }
}

// ─── Virtual Grid ─────────────────────────────────────────────────────────────
function calcLayout() {
  const w = gridScroll.clientWidth - 6; // account for scrollbar
  columns   = Math.max(1, Math.floor(w / CELL_TOTAL));
  totalRows = Math.ceil(TOTAL_CHECKBOXES / columns);

  const totalH = totalRows * CELL_TOTAL;
  gridSpacer.style.height = totalH + 'px';
  gridRows.style.top      = '0';
}

function renderVisibleRows() {
  const scrollTop     = gridScroll.scrollTop;
  const viewH         = gridScroll.clientHeight;

  const firstRow = Math.max(0, Math.floor(scrollTop / CELL_TOTAL) - BUFFER_ROWS);
  const lastRow  = Math.min(totalRows - 1, Math.ceil((scrollTop + viewH) / CELL_TOTAL) + BUFFER_ROWS);

  // Remove rows outside window
  for (const [ri, { el }] of renderedRows.entries()) {
    if (ri < firstRow || ri > lastRow) {
      el.remove();
      renderedRows.delete(ri);
    }
  }

  // Add missing rows
  for (let ri = firstRow; ri <= lastRow; ri++) {
    if (renderedRows.has(ri)) continue;

    const rowEl      = document.createElement('div');
    rowEl.className  = 'grid-row';
    rowEl.style.top  = ri * CELL_TOTAL + 'px';
    rowEl.style.position = 'absolute';
    rowEl.style.left = '0';
    rowEl.style.right = '0';

    const startIndex = ri * columns;
    const endIndex   = Math.min(TOTAL_CHECKBOXES - 1, startIndex + columns - 1);

    for (let i = startIndex; i <= endIndex; i++) {
      const cell       = document.createElement('div');
      cell.className   = 'cb-cell' + (getBit(i) ? ' checked' : '');
      cell.textContent = getBit(i) ? '✕' : '';
      cell.dataset.idx = i;

      cell.addEventListener('click', () => onCellClick(i, cell));
      rowEl.appendChild(cell);
    }

    gridRows.appendChild(rowEl);
    renderedRows.set(ri, { el: rowEl, startIndex });
  }
}

function getCellEl(index) {
  const ri = Math.floor(index / columns);
  const entry = renderedRows.get(ri);
  if (!entry) return null;
  const localIdx = index - entry.startIndex;
  return entry.el.children[localIdx] || null;
}

function updateCellVisual(index, value) {
  const cell = getCellEl(index);
  if (!cell) return;
  if (value) {
    cell.classList.add('checked');
    cell.textContent = '✕';
  } else {
    cell.classList.remove('checked');
    cell.textContent = '';
  }
  cell.classList.add('just-toggled');
  cell.addEventListener('animationend', () => cell.classList.remove('just-toggled'), { once: true });
}

// ─── Cell click handler ───────────────────────────────────────────────────────
function onCellClick(index, cell) {
  if (!user) {
    showToast('ログインが必要です · Login required to interact');
    return;
  }

  const currentVal = getBit(index);
  const newVal     = currentVal ? 0 : 1;

  // Optimistic update
  setBit(index, newVal);
  if (newVal) { checkedCount++; } else { checkedCount--; }
  updateStats();
  updateCellVisual(index, newVal);

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'toggle', index, value: newVal }));
  }
}

// ─── Initial state ────────────────────────────────────────────────────────────
function seedRandomBits() {
  for (let i = 0; i < 150; i++) {
    const idx = Math.floor(Math.random() * TOTAL_CHECKBOXES);
    if (!getBit(idx)) {
      setBit(idx, 1);
      checkedCount++;
    }
  }
}

async function fetchInitialState() {
  loaderFill.style.width = '30%';
  loaderText.textContent = 'ネットワーク接続中… FETCHING STATE';

  try {
    const res  = await fetch('/api/state');
    const buf  = await res.arrayBuffer();
    loaderFill.style.width = '80%';

    const newArr  = new Uint8Array(buf);
    stateArray    = newArr;
    checkedCount  = countAllBits(stateArray);

    loaderFill.style.width = '100%';
    loaderText.textContent = '完了 · COMPLETE';

    setTimeout(() => loadingOverlay.classList.add('hidden'), 300);

    calcLayout();
    renderVisibleRows();
    updateStats();

    badgeRedis.classList.add('active');
  } catch (err) {
    console.error('Failed to load state', err);
    loaderText.textContent = 'エラー · LOAD FAILED';
    showToast('Failed to load initial state');
  }
}

// ─── WebSocket ────────────────────────────────────────────────────────────────
function initWs() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${proto}//${location.host}`);

  ws.addEventListener('open', () => {
    connBadge.classList.add('connected');
    connBadge.classList.remove('disconnected');
    connLabel.textContent = 'CONNECTED';
    badgeWs.classList.add('active');

    // Start ping loop
    startPingLoop();
  });

  ws.addEventListener('close', () => {
    connBadge.classList.remove('connected');
    connBadge.classList.add('disconnected');
    connLabel.textContent = 'DISCONNECTED';
    badgeWs.classList.remove('active');
    // Reconnect after 3s
    setTimeout(initWs, 3000);
  });

  ws.addEventListener('error', () => {
    console.error('WebSocket error');
  });

  ws.addEventListener('message', ({ data }) => {
    const msg = JSON.parse(data);

    if (msg.type === 'state') {
      // Decode base64 -> Uint8Array
      const bin = atob(msg.data);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      stateArray   = arr;
      checkedCount = countAllBits(stateArray);
      updateStats();
      // Refresh all visible cells
      for (const [ri, { el, startIndex }] of renderedRows.entries()) {
        Array.from(el.children).forEach((cell, ci) => {
          const idx = startIndex + ci;
          if (idx >= TOTAL_CHECKBOXES) return;
          const v = getBit(idx);
          if (v) { cell.classList.add('checked'); cell.textContent = '✕'; }
          else   { cell.classList.remove('checked'); cell.textContent = ''; }
        });
      }
    }

    else if (msg.type === 'update') {
      const { index, value } = msg;
      const old = getBit(index);
      setBit(index, value);
      if (value && !old)  checkedCount++;
      if (!value && old)  checkedCount--;
      updateStats();
      updateCellVisual(index, value);
      addToTicker(index, value);
    }

    else if (msg.type === 'user_count') {
      userCountEl.textContent = msg.count;
    }

    else if (msg.type === 'error') {
      const reasons = {
        rate_limited:    'レート制限 · Too many clicks — slow down',
        unauthenticated: 'ログインが必要です · Login required to interact'
      };
      showToast(reasons[msg.reason] || msg.reason);
    }

    else if (msg.type === 'pong') {
      const latency = Date.now() - msg.ts;
      pingVal.textContent = latency;
    }
  });
}

// ─── Ping loop ────────────────────────────────────────────────────────────────
function startPingLoop() {
  const loop = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
    }
  };
  loop();
  setInterval(loop, PING_INTERVAL_MS);
}

// ─── Scroll & resize ─────────────────────────────────────────────────────────
gridScroll.addEventListener('scroll', () => {
  requestAnimationFrame(renderVisibleRows);
}, { passive: true });

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    // Wipe all rendered rows and recalculate
    for (const { el } of renderedRows.values()) el.remove();
    renderedRows.clear();
    calcLayout();
    renderVisibleRows();
  }, 100);
});

// ─── System badge states ─────────────────────────────────────────────────────
// We mark OIDC as 'active' only when user is loaded
// Redis and WS are activated on successful data load / ws open

// ─── Boot sequence ────────────────────────────────────────────────────────────
async function boot() {
  // Seed placeholder bits so the grid looks alive immediately
  seedRandomBits();
  calcLayout();
  renderVisibleRows();
  updateStats();

  await fetchUser();        // populate auth UI
  await fetchInitialState();// real state replaces seeded bits
  initWs();                 // open WebSocket
}

boot();
