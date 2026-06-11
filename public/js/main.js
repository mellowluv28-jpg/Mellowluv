let allProductsCache = {};

async function loadProducts(category, containerId, sort) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '<div class="loading"><div class="spinner"></div>Loading products...</div>';
  try {
    let url = `/api/products?category=${category}`;
    if (sort) url += `&sort=${sort}`;
    const res = await fetch(url);
    const products = await res.json();
    allProductsCache[containerId] = products;
    renderProducts(containerId, products);
  } catch (err) {
    container.innerHTML = '<div class="loading">Failed to load products. Please try again.</div>';
  }
}

function renderProducts(containerId, products) {
  const container = document.getElementById(containerId);
  if (products.length === 0) {
    container.innerHTML = '<div class="loading" style="grid-column: 1/-1;">No products available yet. Check back soon!</div>';
    return;
  }
  clearAllCountdowns();
  container.innerHTML = products.map(p => {
    const inStock = p.stock > 0;
    const hasOffer = p.offer_price && p.offer_price > 0;
    const isScheduled = p.scheduled_at && new Date(p.scheduled_at) > new Date();
    const isLive = !isScheduled;
    const displayPrice = hasOffer ? `<span class="product-price-original">₹${p.price}</span> <span class="product-price-offer">₹${p.offer_price}</span>` : `<span class="product-price">₹${p.price}</span>`;
    const offerBadge = hasOffer && isLive ? `<div class="offer-badge">🔥 OFFER</div>` : '';
    const offerNote = hasOffer && isLive && p.offer_note ? `<div class="offer-note">${p.offer_note}</div>` : '';
    const dropText = isScheduled ? formatDropTime(p.scheduled_at, p.id) : '';
    const dropBadge = isScheduled ? `<div class="drop-badge">📅 DROPPING SOON</div>` : '';
    const scheduledOn = isScheduled ? `<div class="drop-time">${dropText}</div>` : '';
    const stockLabel = isScheduled ? '🔒 Coming Soon' : (inStock ? `In Stock (${p.stock} available)` : 'Out of Stock');
    const stockClass = inStock && isLive ? 'stock-in' : 'stock-out';
    return `
      <div class="product-card${hasOffer && isLive ? ' on-offer' : ''}${isScheduled ? ' scheduled' : ''}">
        <a href="/public/product.html?id=${p.id}" style="text-decoration:none;color:inherit;">
        <div class="product-img" style="${p.image ? `background-image: url('${p.image}'); background-size: cover; background-position: center;` : ''}">${p.image ? '' : '📷'}</div>
        ${offerBadge}${dropBadge}
        <div class="product-info">
          <div class="product-name">${p.name}</div>
          <div class="product-price-row">${displayPrice}</div>
          ${offerNote}
          ${scheduledOn}
          <div class="product-shipping">* Shipping charged separately</div>
          <div class="product-stock ${stockClass}">${stockLabel}</div>
        </a>
          <div style="display:flex;gap:6px;">
            ${isLive && inStock ? `<button class="btn-buy" onclick="event.stopPropagation();buyProduct(${p.id})" style="flex:1;">${hasOffer ? 'Grab Offer 🎉' : 'Buy Now'}</button>` : ''}
            ${isLive && inStock ? `<button class="btn-add-cart" onclick="event.stopPropagation();addToCart(${p.id},'${p.name.replace(/'/g,"\\'")}',${p.offer_price||p.price},${p.price},'${(p.image||'').replace(/'/g,"\\'")}','${p.category}')" title="Add to Cart">🛒</button>` : ''}
            ${isScheduled ? `<button class="btn-buy" onclick="event.stopPropagation();location.href='/public/prebook.html?product=${p.id}'" style="flex:1;background:linear-gradient(135deg,#f3e5f5,#fce4ec);border-color:#ce93d8;color:#7b1fa2;">📅 Pre-Book</button>` : ''}
            ${!isLive && !inStock && !isScheduled ? `<button class="btn-buy" disabled style="flex:1;">Sold Out</button>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  const scheduled = products.filter(p => p.scheduled_at && new Date(p.scheduled_at) > new Date());
  scheduled.forEach(p => startLiveCountdown('cd-' + p.id, p.scheduled_at));
}

function searchProducts(inputId, containerId) {
  const query = document.getElementById(inputId).value.toLowerCase().trim();
  const all = allProductsCache[containerId] || [];
  if (!query) { renderProducts(containerId, all); return; }
  const filtered = all.filter(p => p.name.toLowerCase().includes(query) || (p.description || '').toLowerCase().includes(query));
  renderProducts(containerId, filtered);
  const container = document.getElementById(containerId);
  if (filtered.length === 0) {
    container.innerHTML = '<div class="loading" style="grid-column: 1/-1;">No products match your search 🐱</div>';
  }
}

let _countdownIntervals = [];

function clearAllCountdowns() {
  _countdownIntervals.forEach(id => clearInterval(id));
  _countdownIntervals = [];
}

function startLiveCountdown(elementId, targetIso) {
  const target = new Date(targetIso);
  const el = document.getElementById(elementId);
  if (!el) return;
  function tick() {
    const diff = target - new Date();
    if (diff <= 0) { el.textContent = '📦 Live Now!'; el.style.color = '#2e7d32'; return; }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    let text = '';
    if (days > 0) text += days + 'd ';
    text += String(hours).padStart(2, '0') + 'h ' + String(mins).padStart(2, '0') + 'm ' + String(secs).padStart(2, '0') + 's';
    el.textContent = text;
  }
  tick();
  const id = setInterval(tick, 1000);
  _countdownIntervals.push(id);
  return id;
}

function formatDropTime(isoStr, productId) {
  const d = new Date(isoStr);
  const diff = d - new Date();
  if (diff <= 0) return '📦 Live now!';
  return `<span class="live-countdown" id="cd-${productId}">--d --h --m --s</span>`;
}

function buyProduct(productId) {
  window.location.href = `/public/checkout.html?product=${productId}`;
}

async function addToCart(id, name, offerPrice, price, image, category, qty) {
  try {
    const res = await fetch('/api/products/' + id);
    const product = await res.json();
    if (!product || product.error) return alert('Product not found!');
    if (product.stock < 1) return alert('Out of stock!');
    if (!product.is_live) return alert('This product is not available yet!');

    qty = qty || 1;
    let cart = JSON.parse(localStorage.getItem('mellowluv_cart') || '{"items":[]}');
    const existing = cart.items.find(i => i.id === id);
    const currentQty = existing ? existing.qty : 0;
    if (currentQty + qty > product.stock) {
      const avail = product.stock - currentQty;
      if (avail <= 0) return alert('Only ' + product.stock + ' in stock!');
      return alert('Only ' + avail + ' more in stock!');
    }

    if (existing) { existing.qty += qty; } else { cart.items.push({ id, name, offer_price: offerPrice, price, image, category, qty }); }
    localStorage.setItem('mellowluv_cart', JSON.stringify(cart));
    updateCartBadge();
    const btn = event?.target || document.querySelector('[onclick*="addToCart(' + id + ')"]');
    if (btn) { btn.textContent = '✅'; setTimeout(() => btn.textContent = '🛒', 1000); }
  } catch { alert('Network error. Try again.'); }
}

function updateCartBadge() {
  const cart = JSON.parse(localStorage.getItem('mellowluv_cart') || '{"items":[]}');
  const count = cart.items.reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll('.cart-badge').forEach(b => { b.textContent = count > 0 ? count : ''; b.style.display = count > 0 ? 'inline' : 'none'; });
  const fabBadge = document.getElementById('cart-fab-badge');
  if (fabBadge) { fabBadge.textContent = count > 0 ? count : ''; fabBadge.style.display = count > 0 ? 'flex' : 'none'; }
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.cat-icon').forEach(function(img) {
    img.onerror = function() { this.style.display = 'none'; };
  });

  updateCartBadge();
  if (!document.querySelector('.cart-fab')) {
    const hidePages = ['/public/cart.html', '/public/checkout.html', '/public/order-success.html'];
    if (hidePages.some(p => window.location.pathname.endsWith(p))) return;
    const fab = document.createElement('a');
    fab.href = '/public/cart.html';
    fab.className = 'cart-fab';
    fab.innerHTML = '🛒<span class="cart-fab-badge" id="cart-fab-badge">0</span>';
    document.body.appendChild(fab);
  }
});

function updateSort(category, containerId, selectEl) {
  loadProducts(category, containerId, selectEl.value);
}

function openZoom(src) {
  document.getElementById('zoom-img').src = src;
  document.getElementById('zoom-overlay').classList.add('show');
}

function closeZoom() {
  document.getElementById('zoom-overlay').classList.remove('show');
}

function openSizeChart() {
  document.getElementById('sizechart-popup').classList.add('show');
  document.getElementById('sizechart-overlay').classList.add('show');
}

function closeSizeChart() {
  document.getElementById('sizechart-popup').classList.remove('show');
  document.getElementById('sizechart-overlay').classList.remove('show');
}

async function loadDealBanner() {
  try {
    const res = await fetch('/api/products?sort=price_asc');
    const products = await res.json();
    const live = products.filter(p => p.is_live !== false);
    const deals = live.filter(p => p.offer_price && p.offer_price > 0);
    if (deals.length === 0) return;
    const best = deals.sort((a,b) => (a.offer_price/a.price) - (b.offer_price/b.price))[0];
    const banner = document.getElementById('deal-banner');
    if (!banner) return;
    const discount = Math.round((1 - best.offer_price / best.price) * 100);
    banner.style.display = 'flex';
    banner.innerHTML = `🔥 <strong>${discount}% OFF</strong> on ${best.name}! <a href="/public/checkout.html?product=${best.id}" class="deal-link">Shop Now →</a>`;
  } catch {}
}

if (document.getElementById('deal-banner')) loadDealBanner();
