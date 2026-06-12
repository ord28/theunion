const PARENT_ID = '2f0731248115d5472d6b554aad5073a96a960e0b5b39618e5f6d5e43cfd3b217i0';
const ORD = 'https://ordinals.com';

let allIds = [];
let seenIds = new Set();
let cardCount = 0;

// ── AUDIO ─────────────────────────────────────────
const audio = document.getElementById('ambient');
let muted = false;
audio.volume = 0.22; // very low — ambient

function startAudio() {
  if (!audio.paused) return;
  // iOS requires user gesture — resume AudioContext if suspended
  audio.play().then(() => {
    console.log('Audio playing');
  }).catch(e => {
    console.log('Audio blocked:', e);
  });
}

function toggleMute() {
  muted = !muted;
  audio.muted = muted;
  const btn = document.getElementById('mute-btn');
  btn.textContent = muted ? '🔇' : '♪';
  btn.classList.toggle('muted', muted);
}

// ── FETCH ALL CHILDREN PAGES ──────────────────────
// Uses the recursive JSON endpoint: /r/children/<id> and /r/children/<id>/<page>
// Returns JSON: { "ids": [...], "more": true/false }
async function fetchAllChildren() {
  let page = 0;
  let more = true;

  while (more) {
    try {
      const url = page === 0
        ? `${ORD}/r/children/${PARENT_ID}`
        : `${ORD}/r/children/${PARENT_ID}/${page}`;

      const res = await fetch(url);
      if (!res.ok) break;
      const data = await res.json();

      const ids = data.ids || [];
      more = data.more || false;

      const newIds = ids.filter(id => !seenIds.has(id));
      newIds.forEach(id => seenIds.add(id));
      allIds = [...allIds, ...newIds];

      if (newIds.length > 0) appendCards(newIds);

      updateStatus();

      if (!more || ids.length === 0) break;
      page++;
    } catch(e) {
      console.warn('Fetch page', page, e);
      break;
    }
  }

  updateStatus(true);
}

function updateStatus(done = false) {
  const el = document.getElementById('load-status');
  const cnt = document.getElementById('loaded-count');
  el.textContent = done
    ? `${allIds.length} inscriptions`
    : `Loading... ${allIds.length} found`;
  cnt.textContent = allIds.length;
}

// ── RENDER CARDS ──────────────────────────────────
function appendCards(ids) {
  const grid = document.getElementById('main-grid');
  ids.forEach(iid => {
    cardCount++;
    const num = cardCount;
    const el = document.createElement('div');
    el.className = 'piece-card';
    el.onclick = () => openLb(iid, num);
    el.innerHTML = `
      <div class="p-img">
        <img src="${ORD}/content/${iid}" alt="UNION #${num}" loading="lazy"
          onerror="this.style.display='none';this.parentNode.style.background='#1a1a1a'">
        <div class="p-overlay"><div class="p-overlay-label">View</div></div>
      </div>
      <div class="p-info">
        <div class="p-num">UNION #${num}</div>
        <div class="p-id">${iid.slice(0,14)}…${iid.slice(-6)}</div>
      </div>`;
    grid.appendChild(el);
  });
}

// ── SKELETONS (while loading) ─────────────────────
function showSkeletons(n) {
  const grid = document.getElementById('main-grid');
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'sk';
    el.innerHTML = '<div class="sk-img"></div><div class="sk-line"></div><div class="sk-line sm"></div>';
    grid.appendChild(el);
  }
}

function clearSkeletons() {
  document.querySelectorAll('.sk').forEach(el => el.remove());
}

// ── LIGHTBOX ──────────────────────────────────────
function openLb(iid, num) {
  const preview = document.getElementById('lb-preview');
  preview.innerHTML = `<img src="${ORD}/content/${iid}" alt="UNION #${num}"
    onerror="this.outerHTML='<iframe src=\"${ORD}/preview/${iid}\" style=\"width:100%;height:100%;border:none\"></iframe>'">`;
  document.getElementById('lb-num').textContent = `UNION #${num} of ${allIds.length}`;
  document.getElementById('lb-iid').textContent = iid;
  document.getElementById('lb-link').href = `${ORD}/inscription/${iid}`;
  document.getElementById('lb-traits').innerHTML = [
    ['Chain','Bitcoin'],['Protocol','Ordinals'],['Parent','106659301'],['Supply','100']
  ].map(([k,v]) => `<div class="lb-trait"><div class="lb-trait-k">${k}</div><div class="lb-trait-v">${v}</div></div>`).join('');
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLb(e) {
  if (e.target !== document.getElementById('lightbox')) return;
  forceCloseLb();
}
function forceCloseLb() {
  document.getElementById('lightbox').classList.remove('open');
  document.getElementById('lb-preview').innerHTML = '';
  document.body.style.overflow = '';
}

// ── WALLET ────────────────────────────────────────
let connectedAddr = null;

async function connectWallet() {
  const btn = document.getElementById('wallet-btn');
  if (connectedAddr) {
    connectedAddr = null;
    btn.textContent = 'Connect Wallet';
    btn.classList.remove('connected');
    document.getElementById('wallet-panel').classList.remove('visible');
    return;
  }
  btn.textContent = 'Connecting...';

  if (window.XverseProviders?.BitcoinProvider) {
    try {
      const r = await window.XverseProviders.BitcoinProvider.request('getAccounts', { purposes: ['ordinals'] });
      if (r?.result?.length) { onConnect(r.result[0].address, 'Xverse'); return; }
    } catch(e) {}
  }
  if (window.unisat) {
    try {
      const a = await window.unisat.requestAccounts();
      if (a?.length) { onConnect(a[0], 'Unisat'); return; }
    } catch(e) {}
  }
  if (window.magicEden?.bitcoin) {
    try {
      const r = await window.magicEden.bitcoin.connect();
      if (r?.addresses?.length) {
        const addr = r.addresses.find(x => x.purpose === 'ordinals')?.address || r.addresses[0].address;
        onConnect(addr, 'Magic Eden'); return;
      }
    } catch(e) {}
  }

  btn.textContent = 'Connect Wallet';
  showToast('No Bitcoin wallet found. Install Xverse or Unisat.');
}

function onConnect(address, wallet) {
  connectedAddr = address;
  const btn = document.getElementById('wallet-btn');
  btn.textContent = address.slice(0,6) + '...' + address.slice(-4);
  btn.classList.add('connected');
  document.getElementById('wallet-addr').textContent = wallet + ' · ' + address;
  document.getElementById('wallet-panel').classList.add('visible');
  showToast(wallet + ' connected ✓');
  checkHoldings(address);
}

async function checkHoldings(address) {
  const countEl  = document.getElementById('holdings-count');
  const subEl    = document.getElementById('holdings-sub');
  const badgeEl  = document.getElementById('holder-badge');
  const thumbsEl = document.getElementById('wallet-thumbs');
  countEl.textContent = '...';
  subEl.textContent   = 'Scanning wallet...';
  thumbsEl.innerHTML  = '';

  try {
    // Fetch ALL wallet inscriptions (paginate up to 600)
    let walletIds = new Set();
    for (let offset = 0; offset < 600; offset += 60) {
      const res  = await fetch(
        `https://api.hiro.so/ordinals/v1/inscriptions?address=${address}&limit=60&offset=${offset}`
      );
      const data = await res.json();
      const results = data.results || [];
      results.forEach(i => walletIds.add(i.id));
      if (results.length < 60) break; // no more pages
    }

    // Cross-reference against the collection IDs fetched from chain
    let matches = allIds.filter(id => walletIds.has(id));

    // Fallback: also query Hiro with parent inscription filter
    // Hiro accepts the parent txid (without index) as a filter
    if (matches.length === 0) {
      try {
        const parentTx = PARENT_ID.replace(/i\d+$/, ''); // strip the 'iN' suffix
        const r2   = await fetch(
          `https://api.hiro.so/ordinals/v1/inscriptions?address=${address}&parent=${parentTx}&limit=60`
        );
        const d2   = await r2.json();
        (d2.results || []).forEach(i => {
          walletIds.add(i.id);
          if (!matches.includes(i.id)) matches.push(i.id);
        });
      } catch(e) {}
    }

    // Fallback 2: directly query ordinals.com for this address's children of parent
    if (matches.length === 0) {
      try {
        // Check if any of the wallet's inscription IDs appear in our fetched allIds set
        // allIds is populated from the chain — re-check after ensuring allIds is full
        matches = allIds.filter(id => walletIds.has(id));
      } catch(e) {}
    }

    const count = matches.length;
    countEl.textContent = count;

    if (count > 0) {
      subEl.textContent       = 'Member of TheUnion';
      badgeEl.textContent     = 'HOLDER';
      badgeEl.className       = 'holder-badge badge-yes';
      showToast(`${count} Union piece${count > 1 ? 's' : ''} found 🔥`);
      matches.slice(0, 12).forEach(iid => {
        const el = document.createElement('div');
        el.className = 'w-thumb';
        const num = allIds.indexOf(iid) + 1;
        el.innerHTML = `<img src="${ORD}/content/${iid}" loading="lazy"><span>#${num}</span>`;
        el.onclick = () => openLb(iid, num);
        thumbsEl.appendChild(el);
      });
    } else {
      // Show what the wallet actually holds so user can debug
      const total = walletIds.size;
      subEl.textContent   = total > 0
        ? `Wallet has ${total} inscription${total>1?'s':''} — none match TheUnion`
        : 'No inscriptions found in this wallet';
      badgeEl.textContent = 'Non-holder';
      badgeEl.className   = 'holder-badge badge-no';
      showToast(total > 0 ? `${total} inscriptions found, none are TheUnion` : 'No inscriptions found.');
    }
  } catch(err) {
    console.error('checkHoldings error:', err);
    countEl.textContent = '?';
    subEl.textContent   = 'API error — try again or check Ord.net manually';
    badgeEl.textContent = 'Error';
    badgeEl.className   = 'holder-badge badge-no';
  }
}

// ── TOAST ─────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ── INIT ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Hero grid
  const grid = document.getElementById('hero-grid');
  for (let i = 0; i < 32; i++) grid.appendChild(document.createElement('div'));

  // Gallery loads on demand when user clicks View Gallery

  // Restore theme
  if (localStorage.getItem('union-theme') === 'light') {
    document.body.classList.add('light');
    document.getElementById('theme-btn').textContent = '☀️';
  }

  // Fetch BTC price immediately + refresh every 60s
  fetchBtcPrice();
  setInterval(fetchBtcPrice, 60000);

  // Try autoplay immediately
  setTimeout(() => startAudio(), 800);
  // Fallback: start on first any interaction
  ['click','keydown','touchstart','scroll'].forEach(evt =>
    document.addEventListener(evt, () => startAudio(), { once: true, passive: true })
  );
});



// ── THEME TOGGLE ──────────────────────────────────
function toggleTheme() {
  const light = document.body.classList.toggle('light');
  document.getElementById('theme-btn').textContent = light ? '☀️' : '🌙';
  localStorage.setItem('union-theme', light ? 'light' : 'dark');
}

// ── CURRENCY ──────────────────────────────────────
let currencyMode = 'crypto'; // 'crypto' | 'usd'
let btcUsd = null;
const FLOOR_BTC = 0.002; // TheUnion floor in BTC

function toggleCurrency() {
  currencyMode = currencyMode === 'crypto' ? 'usd' : 'crypto';
  document.getElementById('cur-crypto').classList.toggle('active', currencyMode === 'crypto');
  document.getElementById('cur-usd').classList.toggle('active', currencyMode === 'usd');
  updatePriceDisplay();
  updateFloorDisplay();
}

function updatePriceDisplay() {
  const el = document.getElementById('btc-price-display');
  if (!btcUsd) { el.textContent = 'BTC —'; return; }
  if (currencyMode === 'usd') {
    el.textContent = 'BTC $' + btcUsd.toLocaleString('en-US', { maximumFractionDigits: 0 });
  } else {
    el.textContent = '₿ ' + btcUsd.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
}

function updateFloorDisplay() {
  const heroEl = document.getElementById('stat-floor');
  const bbEl   = document.getElementById('bb-floor-display');
  if (currencyMode === 'usd' && btcUsd) {
    const usd = (FLOOR_BTC * btcUsd).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    if (heroEl) heroEl.textContent = usd;
    if (bbEl)   bbEl.textContent   = usd;
  } else {
    if (heroEl) heroEl.textContent = FLOOR_BTC + ' BTC';
    if (bbEl)   bbEl.textContent   = FLOOR_BTC;
  }
}

async function fetchBtcPrice() {
  try {
    const res  = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
    const data = await res.json();
    btcUsd = parseFloat(data.data?.amount);
    updatePriceDisplay();
    updateFloorDisplay();
  } catch(e) {
    try {
      const r2 = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      const d2 = await r2.json();
      btcUsd = d2.bitcoin?.usd;
      updatePriceDisplay();
      updateFloorDisplay();
    } catch(e2) {}
  }
}


function closeXDropdown() {
  document.getElementById('x-dropdown').classList.remove('open');
}
document.addEventListener('click', e => {
  if (!e.target.closest('.x-btn-wrap')) closeXDropdown();
});


// ── DRAWER ────────────────────────────────────────
let drawerHoverTimer = null;

function openDrawer() {
  clearTimeout(drawerHoverTimer);
  document.getElementById('side-content').classList.add('open');
}

function scheduleClose() {
  drawerHoverTimer = setTimeout(() => {
    document.getElementById('side-content').classList.remove('open');
  }, 120); // small delay so cursor can travel between tab and content
}

function toggleDrawer() {
  const c = document.getElementById('side-content');
  if (c.classList.contains('open')) {
    c.classList.remove('open');
  } else {
    openDrawer();
  }
}

function closeDrawer() {
  clearTimeout(drawerHoverTimer);
  document.getElementById('side-content').classList.remove('open');
}

// Wire hover on tab and content
document.addEventListener('DOMContentLoaded', () => {
  const tab     = document.getElementById('side-tab');
  const content = document.getElementById('side-content');

  if (tab && content) {
    // Hovering tab opens drawer
    tab.addEventListener('mouseenter', openDrawer);
    tab.addEventListener('mouseleave', scheduleClose);

    // Hovering content keeps it open
    content.addEventListener('mouseenter', openDrawer);
    content.addEventListener('mouseleave', scheduleClose);
  }

  // Click outside closes it
  document.addEventListener('click', e => {
    if (!e.target.closest('#side-content') && !e.target.closest('#side-tab')) {
      closeDrawer();
    }
  });
});

// ── PAGE SWITCHING ────────────────────────────────
function showGalleryPage() {
  document.getElementById('home-page').classList.add('hidden');
  document.getElementById('about-page').style.display = 'none';
  document.getElementById('gallery-page').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  // Start loading if not already done
  if (allIds.length === 0) {
    showSkeletons(20);
    fetchAllChildren().then(() => clearSkeletons());
  }
}

function showHomePage() {
  document.getElementById('gallery-page').classList.remove('active');
  document.getElementById('about-page').style.display = 'none';
  document.getElementById('home-page').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function showAboutPage() {
  document.getElementById('home-page').classList.add('hidden');
  document.getElementById('gallery-page').classList.remove('active');
  document.getElementById('about-page').style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


document.addEventListener('keydown', e => {
  if (e.key === 'Escape') forceCloseLb();
});
