/* Ergo Mempool Radar — app.js */
const API = 'https://api.ergoplatform.com';
const WHALE_THRESHOLD_ERG = 10000; // 10k ERG
const REFRESH_MS = 15000;

const $ = id => document.getElementById(id);
let tickerItems = [];
let lastRefresh = 0;

// ── helpers ──────────────────────────────────────────────────────────────────
const nanoToErg = nano => (nano / 1e9).toLocaleString('en-US', { maximumFractionDigits: 2 });
const shortId  = id  => id ? id.slice(0, 8) + '…' + id.slice(-6) : '—';
const now      = ()  => new Date().toLocaleTimeString();

function setStatus(live, text) {
  const b = $('statusBadge');
  b.textContent = text;
  b.className = 'badge' + (live ? ' live' : '');
}

// ── fetch helpers ─────────────────────────────────────────────────────────────
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ── price + block ─────────────────────────────────────────────────────────────
async function loadMeta() {
  try {
    const [priceData, info] = await Promise.all([
      fetchJSON(`${API}/api/v1/info`),
      fetchJSON(`${API}/api/v1/info`)
    ]);
    // ergoplatform /api/v1/info returns currentHeight, etc.
    // price via coingecko as ergoplatform doesn't serve price directly
    const cg = await fetchJSON('https://api.coingecko.com/api/v3/simple/price?ids=ergo&vs_currencies=usd');
    const price = cg?.ergo?.usd;
    $('ergPrice').textContent = price ? `$${price.toFixed(2)}` : '—';
    $('blockHeight').textContent = priceData?.currentHeight?.toLocaleString() ?? '—';
  } catch {
    $('ergPrice').textContent = 'err';
  }
}

// ── mempool ───────────────────────────────────────────────────────────────────
async function loadMempool() {
  const data = await fetchJSON(`${API}/api/v1/mempool/transactions?limit=50&offset=0`);
  const txs = data?.items ?? [];
  $('pendingCount').textContent = data?.total ?? txs.length;
  return txs;
}

// ── fee histogram ─────────────────────────────────────────────────────────────
function renderHistogram(txs) {
  const fees = txs.map(tx => {
    const inSum  = (tx.inputs  ?? []).reduce((s, i) => s + (i.value ?? 0), 0);
    const outSum = (tx.outputs ?? []).reduce((s, o) => s + (o.value ?? 0), 0);
    return Math.max(0, inSum - outSum);
  }).filter(f => f > 0);

  if (!fees.length) return;

  const BUCKETS = 12;
  const min = Math.min(...fees);
  const max = Math.max(...fees);
  const range = max - min || 1;
  const buckets = Array(BUCKETS).fill(0);
  fees.forEach(f => {
    const idx = Math.min(BUCKETS - 1, Math.floor(((f - min) / range) * BUCKETS));
    buckets[idx]++;
  });

  const peak = Math.max(...buckets, 1);
  const hist = $('histogram');
  hist.innerHTML = buckets.map((count, i) => {
    const pct = (count / peak * 100).toFixed(1);
    const feeLabel = ((min + (range / BUCKETS) * i) / 1e6).toFixed(2) + ' mERG';
    return `<div class="hist-bar" style="height:${Math.max(2, pct)}%" data-tip="${count} tx · ~${feeLabel}"></div>`;
  }).join('');
}

// ── whale alerts ──────────────────────────────────────────────────────────────
function renderWhales(txs) {
  const whales = txs.filter(tx => {
    const outErg = (tx.outputs ?? []).reduce((s, o) => s + (o.value ?? 0), 0) / 1e9;
    return outErg >= WHALE_THRESHOLD_ERG;
  }).slice(0, 8);

  const list = $('whaleList');
  if (!whales.length) {
    list.innerHTML = '<li class="placeholder">No whales lurking right now…</li>';
    return;
  }

  list.innerHTML = whales.map(tx => {
    const erg = ((tx.outputs ?? []).reduce((s, o) => s + (o.value ?? 0), 0) / 1e9).toLocaleString('en-US', { maximumFractionDigits: 0 });
    return `
      <li class="alert-item">
        🐋 <span class="whale-size">${erg} ERG</span>
        &nbsp;<span class="whale-id"><a href="https://explorer.ergoplatform.com/en/transactions/${tx.id}" target="_blank">${shortId(tx.id)}</a></span>
      </li>`;
  }).join('');
}

// ── tx table ──────────────────────────────────────────────────────────────────
function tagTx(outErg) {
  if (outErg >= WHALE_THRESHOLD_ERG) return '<span class="tag tag-whale">🐋 Whale</span>';
  if (outErg < 0.1)                  return '<span class="tag tag-dust">🌫 Dust</span>';
  return '<span class="tag tag-normal">✓ Normal</span>';
}

function renderTxTable(txs) {
  const body = $('txBody');
  if (!txs.length) {
    body.innerHTML = '<tr><td colspan="6" class="placeholder">Mempool is empty</td></tr>';
    return;
  }

  body.innerHTML = txs.slice(0, 40).map(tx => {
    const inCount  = (tx.inputs  ?? []).length;
    const outCount = (tx.outputs ?? []).length;
    const outErg   = (tx.outputs ?? []).reduce((s, o) => s + (o.value ?? 0), 0) / 1e9;
    const inSum    = (tx.inputs  ?? []).reduce((s, i) => s + (i.value ?? 0), 0);
    const outSum   = (tx.outputs ?? []).reduce((s, o) => s + (o.value ?? 0), 0);
    const feeNano  = Math.max(0, inSum - outSum);
    const size     = tx.size ?? '—';
    return `
      <tr>
        <td class="tx-id"><a href="https://explorer.ergoplatform.com/en/transactions/${tx.id}" target="_blank">${shortId(tx.id)}</a></td>
        <td>${inCount}</td>
        <td>${outCount}</td>
        <td>${size}</td>
        <td>${feeNano > 0 ? feeNano.toLocaleString() : '—'}</td>
        <td>${tagTx(outErg)}</td>
      </tr>`;
  }).join('');
}

// ── ticker commentary ─────────────────────────────────────────────────────────
const QUIPS = [
  'The mempool never sleeps.',
  'Whales move in mysterious ways.',
  'Dust is just ERG waiting to grow.',
  'Every block is a new beginning.',
  'On-chain truth: trustless since day one.',
  'The Oracle watches every byte.',
  'Low fees → high vibes.',
  'Ergo: Proof of Work done right.',
  'Miners rejoice when the mempool swells.',
  'Anonymous. Decentralized. Resilient.',
];

function buildTicker(txs) {
  const total = txs.length;
  const whaleCnt = txs.filter(tx =>
    (tx.outputs ?? []).reduce((s, o) => s + (o.value ?? 0), 0) / 1e9 >= WHALE_THRESHOLD_ERG
  ).length;

  const live = [
    `📡 ${total} pending txs as of ${now()}`,
    whaleCnt > 0 ? `🐋 ${whaleCnt} whale tx${whaleCnt > 1 ? 's' : ''} spotted` : '🌊 No whales currently',
    QUIPS[Math.floor(Math.random() * QUIPS.length)],
    QUIPS[Math.floor(Math.random() * QUIPS.length)],
  ];

  // double for seamless loop
  const all = [...live, ...live];
  const ticker = $('ticker');
  ticker.innerHTML = all.map((t, i) => {
    const hi = t.startsWith('🐋') ? ' highlight' : '';
    return `<span class="ticker-item${hi}">${t}</span>`;
  }).join('');
}

// ── refresh hint ──────────────────────────────────────────────────────────────
function startCountdown() {
  clearInterval(window._cdTimer);
  let rem = REFRESH_MS / 1000;
  $('refreshHint').textContent = `· next refresh in ${rem}s`;
  window._cdTimer = setInterval(() => {
    rem--;
    if (rem <= 0) clearInterval(window._cdTimer);
    else $('refreshHint').textContent = `· next refresh in ${rem}s`;
  }, 1000);
}

// ── main cycle ────────────────────────────────────────────────────────────────
async function refresh() {
  setStatus(false, '⏳ Fetching…');
  try {
    const [, txs] = await Promise.all([loadMeta(), loadMempool()]);
    renderHistogram(txs);
    renderWhales(txs);
    renderTxTable(txs);
    buildTicker(txs);
    setStatus(true, '🟢 LIVE');
    startCountdown();
    lastRefresh = Date.now();
  } catch (err) {
    setStatus(false, `❌ ${err.message}`);
    console.error(err);
  }
}

// boot
refresh();
setInterval(refresh, REFRESH_MS);
