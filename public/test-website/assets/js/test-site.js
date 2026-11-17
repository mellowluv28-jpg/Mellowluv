/* ==========================================================================
   MELLOWLUV — TEST WEBSITE RUNTIME
   Isolated localStorage keys. Read-only product data. No backend writes.
   ========================================================================== */
(function () {
  'use strict';

  var BASE = '/test-website';
  var CART_KEY = 'mellowluv_tw_cart_v1';
  var WISH_KEY = 'mellowluv_tw_wish_v1';
  var ORDERS_KEY = 'mellowluv_tw_orders_v1';
  var DRAFT_KEY = 'mellowluv_tw_checkout_v1';
  var LOYALTY_KEY = 'mellowluv_tw_loyalty_v1';
  var NOTES_KEY = 'mellowluv_tw_notes_v1';
  var SHIPPING = 70;
  var URGENT_FEE = 50;

  /* ------------------------------------------------------------------ icons */
  var I = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-9.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7 3c0 5-7 9.4-7 9.4Z"/></svg>',
    heartFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-9.4A4.1 4.1 0 0 1 12 7.6a4.1 4.1 0 0 1 7 3c0 5-7 9.4-7 9.4Z"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M5.5 8h13l-1 12h-11l-1-12Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15M13 6l6 6-6 6"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2Z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.6"/><circle cx="16.8" cy="7.2" r="1" fill="currentColor" stroke="none"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M4 7l8 6 8-6"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M3 6h10v9H3zM13 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/></svg>',
    hand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10M12 10V4.5a1.5 1.5 0 0 1 3 0V11M15 11V6.5a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6v-2.5a1.5 1.5 0 0 1 3 0V13"/></svg>',
    gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M3 9h18M12 9v11M12 9S9.5 4 7 4a2.2 2.2 0 0 0 0 5h5ZM12 9s2.5-5 5-5a2.2 2.2 0 0 1 0 5h-5Z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Z"/><path d="M9 12l2 2 4-4"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 6L12 16.7l-5.3 2.9 1.1-6L3.4 9.5l6-.8L12 3.2Z"/></svg>'
  };

  /* ------------------------------------------------------------- botanicals */
  var DECOS = {
    sprig: '<svg viewBox="0 0 60 100" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M30 98C31 72 28 44 33 6"/><path d="M31 74C19 70 13 61 12 50c11 2 18 10 19 24Z" fill="currentColor" fill-opacity=".13"/><path d="M31 56c12-4 18-12 19-23-11 2-18 10-19 23Z" fill="currentColor" fill-opacity=".13"/><path d="M32 38c-9-3-13-9-14-18 8 2 13 8 14 18Z"/><path d="M33 22c7-2 11-7 12-13-6 1-10 6-12 13Z"/><circle cx="33" cy="6" r="4.2" fill="currentColor" fill-opacity=".2"/><circle cx="33" cy="6" r="1.5" fill="currentColor"/></svg>',
    bloom: '<svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g fill="currentColor" fill-opacity=".14"><ellipse cx="40" cy="22" rx="7" ry="13"/><ellipse cx="40" cy="22" rx="7" ry="13" transform="rotate(72 40 40)"/><ellipse cx="40" cy="22" rx="7" ry="13" transform="rotate(144 40 40)"/><ellipse cx="40" cy="22" rx="7" ry="13" transform="rotate(216 40 40)"/><ellipse cx="40" cy="22" rx="7" ry="13" transform="rotate(288 40 40)"/></g><circle cx="40" cy="40" r="4" fill="currentColor" fill-opacity=".35"/><path d="M40 44c-2 11-8 17-18 21"/><path d="M37 52c-6-1-10 1-13 5 5 1 9 0 13-5Z" fill="currentColor" fill-opacity=".12"/></svg>',
    branch: '<svg viewBox="0 0 110 54" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 50C30 44 68 31 106 7"/><path d="M22 43C15 37 14 31 16 25c7 5 9 11 6 18Z" fill="currentColor" fill-opacity=".12"/><path d="M38 37c1-8 5-12 12-14-1 8-5 12-12 14Z" fill="currentColor" fill-opacity=".12"/><path d="M55 30c-7-4-9-9-8-16 7 4 10 9 8 16Z" fill="currentColor" fill-opacity=".12"/><path d="M72 21c2-6 6-9 12-10-2 6-6 9-12 10Z" fill="currentColor" fill-opacity=".12"/><path d="M88 13c-4-3-5-7-4-12 5 3 6 7 4 12Z" fill="currentColor" fill-opacity=".12"/></svg>',
    wild: '<svg viewBox="0 0 70 90" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true"><path d="M36 88C34 64 36 40 41 14"/><path d="M38 64C28 61 22 54 21 45c9 2 15 9 17 19Z" fill="currentColor" fill-opacity=".12"/><path d="M38 44c9-3 14-9 15-18-9 2-14 8-15 18Z" fill="currentColor" fill-opacity=".12"/><g fill="currentColor" fill-opacity=".22"><circle cx="41" cy="12" r="5"/><circle cx="35" cy="18" r="4"/><circle cx="47" cy="19" r="4"/><circle cx="41" cy="24" r="3.6"/></g><circle cx="41" cy="18" r="1.6" fill="currentColor"/><path d="M38 72c-5 0-9 3-10 8 5 0 9-3 10-8Z"/></svg>'
  };

  /* ------------------------------------------------------------------ utils */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) { return '\u20B9' + Number(n || 0).toLocaleString('en-IN'); }
  function cld(url, w) {
    if (!url || url.indexOf('/upload/') === -1) return url || '';
    return url.replace('/upload/', '/upload/f_auto,q_auto,w_' + w + '/');
  }
  function read(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function dateLabel(offsetDays) {
    var d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  /* ------------------------------------------------------------- static data
     Fallback only. The live /api/products feed is always preferred; this keeps
     the preview usable when the API is unreachable (e.g. local dev, no .env).
     ------------------------------------------------------------------------ */
  var FALLBACK = [
    { id: 70, name: 'Medium Mystery Jewellery Jar', description: '13-15 pieces. Minimum 13 pieces. The no of pieces depends on what theme you choose.\n- Please do not forget to mention what theme you want.', price: 1200, offer_price: 999, category: 'jewelry', stock: 1, image: 'https://res.cloudinary.com/dupjhvgba/image/upload/v1787156172/mellowluv/it06omgn1uzofzs8cmdx.jpg', images: '[]' },
    { id: 69, name: 'Starfish swirl cord', description: 'Available in silver and gold. Don\'t forget to mention your preference before confirming your order. <3', price: 120, offer_price: null, category: 'jewelry', stock: 8, image: 'https://res.cloudinary.com/dupjhvgba/image/upload/v1784910261/mellowluv/m77gg5s1os8l1rwjaub0.jpg', images: '["https://res.cloudinary.com/dupjhvgba/image/upload/v1784884630/mellowluv/rpkdkdo67cvl8z71hyds.jpg"]' },
    { id: 21, name: 'Custom Jar', description: 'If you want a custom jar or a mix, then do send me your preferences before confirming your order. 5-6 pieces.\nAll high quality products.', price: 420, offer_price: null, category: 'jewelry', stock: 1, image: 'https://res.cloudinary.com/dupjhvgba/image/upload/v1781248630/mellowluv/dt1xi1r5dota5wcyoyqt.jpg', images: '[]' },
    { id: 20, name: 'Vintage jewellery jar', description: '5 pieces. The pictures are just examples. Preferences are accepted! All high-quality products <3', price: 420, offer_price: null, category: 'jewelry', stock: 4, image: 'https://res.cloudinary.com/dupjhvgba/image/upload/v1781205692/mellowluv/zocupx8y2cw2wjmmagg5.jpg', images: '["https://res.cloudinary.com/dupjhvgba/image/upload/v1781205693/mellowluv/p6ub3k5ttny2fel08yon.jpg"]' },
    { id: 19, name: 'Y2K mystery jar', description: '5-6 pieces. The pictures are just examples. Preferences are accepted! All high-quality products <3', price: 400, offer_price: null, category: 'jewelry', stock: 0, image: 'https://res.cloudinary.com/dupjhvgba/image/upload/v1781198721/mellowluv/nsibylmorcwk76ndwgof.jpg', images: '["https://res.cloudinary.com/dupjhvgba/image/upload/v1781198722/mellowluv/dopncm7ahdlklyxi7buo.jpg"]' },
    { id: 18, name: 'Whimsy Mystery jar', description: '5-6 pieces. The pictures are just examples. Preferences are accepted! All high-quality products <3', price: 390, offer_price: null, category: 'jewelry', stock: 0, image: 'https://res.cloudinary.com/dupjhvgba/image/upload/v1781198023/mellowluv/jc1xf0pvl8sdw8sb2c8o.jpg', images: '["https://res.cloudinary.com/dupjhvgba/image/upload/v1781198024/mellowluv/sf6dhv6s6lcrxgc0fgdr.jpg"]' },
    { id: 17, name: 'Golden mystery jewellery jar', description: '5-6 pieces. The pictures are just examples. Preferences are accepted! All high-quality products <3', price: 450, offer_price: null, category: 'jewelry', stock: 5, image: 'https://res.cloudinary.com/dupjhvgba/image/upload/v1781182457/mellowluv/bmzmtczfywlmv0nlylsa.jpg', images: '["https://res.cloudinary.com/dupjhvgba/image/upload/v1781182458/mellowluv/xwms5pgprganbghh2nic.jpg"]' },
    { id: 14, name: 'Gothic jar', description: '5-6 pieces. The pictures are just examples. Preferences are accepted! All high-quality products <3', price: 400, offer_price: null, category: 'jewelry', stock: 0, image: 'https://res.cloudinary.com/dupjhvgba/image/upload/v1781180171/mellowluv/ro1inpcrc1gfh4ga7vxr.jpg', images: '[]' }
  ];

  var allProducts = null;
  var productPromise = null;

  function normalize(p) {
    var imgs = [];
    try { var parsed = JSON.parse(p.images || '[]'); if (Array.isArray(parsed)) imgs = parsed; } catch (e) {}
    var gallery = [p.image].concat(imgs).filter(Boolean).filter(function (v, i, a) { return a.indexOf(v) === i; });
    return {
      id: Number(p.id),
      name: p.name || 'Handmade piece',
      description: p.description || '',
      price: Number(p.price) || 0,
      offer_price: p.offer_price ? Number(p.offer_price) : null,
      category: p.category || 'jewelry',
      stock: Number(p.stock) || 0,
      image: p.image || '',
      gallery: gallery,
      is_live: p.is_live !== false,
      scheduled_at: p.scheduled_at || null
    };
  }

  function products(force) {
    if (allProducts && !force) return Promise.resolve(allProducts);
    if (productPromise) return productPromise;
    productPromise = fetch('/api/products', { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); })
      .then(function (data) {
        if (!Array.isArray(data) || !data.length) throw new Error('empty');
        allProducts = data.map(normalize).filter(function (p) {
          return p.is_live && (!p.scheduled_at || new Date(p.scheduled_at) <= new Date());
        });
        return allProducts;
      })
      .catch(function () {
        allProducts = FALLBACK.map(normalize);
        return allProducts;
      });
    return productPromise;
  }

  function productById(id) {
    return products().then(function (list) {
      return list.filter(function (p) { return p.id === Number(id); })[0] || null;
    });
  }

  /* ------------------------------------------------------------------- cart */
  function getCart() {
    var c = read(CART_KEY, { items: [] });
    if (!c || !Array.isArray(c.items)) return { items: [] };
    return c;
  }
  function saveCart(cart) {
    write(CART_KEY, cart);
    syncBadges();
  }
  function cartCount() {
    return getCart().items.reduce(function (n, i) { return n + (Number(i.qty) || 0); }, 0);
  }
  function addToCart(product, qty) {
    if (!product) return;
    var cart = getCart();
    var found = cart.items.filter(function (i) { return i.id === product.id; })[0];
    var limit = product.stock > 0 ? product.stock : 99;
    if (found) {
      found.qty = Math.min(limit, found.qty + (qty || 1));
    } else {
      cart.items.push({
        id: product.id,
        name: product.name,
        price: product.offer_price || product.price,
        listPrice: product.price,
        image: product.image,
        qty: Math.min(limit, qty || 1)
      });
    }
    saveCart(cart);
    toast('Added to your bag');
  }
  function updateQty(id, qty) {
    var cart = getCart();
    var item = cart.items.filter(function (i) { return i.id === Number(id); })[0];
    if (!item) return;
    item.qty = Math.max(0, Math.min(99, Number(qty) || 0));
    if (item.qty === 0) cart.items = cart.items.filter(function (i) { return i.id !== Number(id); });
    saveCart(cart);
  }
  function removeItem(id) {
    var cart = getCart();
    cart.items = cart.items.filter(function (i) { return i.id !== Number(id); });
    saveCart(cart);
    toast('Removed from your bag');
  }
  function clearCart() {
    saveCart({ items: [] });
  }
  function totals() {
    var items = getCart().items;
    var subtotal = items.reduce(function (n, i) { return n + i.price * i.qty; }, 0);
    var shipping = items.length ? SHIPPING : 0;
    return { subtotal: subtotal, shipping: shipping, total: subtotal + shipping, count: items.reduce(function (n, i) { return n + i.qty; }, 0) };
  }

  /* --------------------------------------------------------------- wishlist */
  function getWish() {
    var w = read(WISH_KEY, []);
    return Array.isArray(w) ? w.map(Number) : [];
  }
  function isWished(id) { return getWish().indexOf(Number(id)) > -1; }
  function toggleWish(id) {
    id = Number(id);
    var w = getWish();
    var at = w.indexOf(id);
    if (at > -1) { w.splice(at, 1); toast('Removed from wishlist'); }
    else { w.push(id); toast('Saved to wishlist'); }
    write(WISH_KEY, w);
    syncBadges();
    syncWishes();
  }
  function syncWishes() {
    $$('[data-wish]').forEach(function (btn) {
      var id = Number(btn.getAttribute('data-wish'));
      var on = isWished(id);
      btn.classList.toggle('is-saved', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.innerHTML = on ? I.heartFill : I.heart;
    });
  }

  function syncBadges() {
    var c = cartCount();
    $$('[data-tw-cart-count]').forEach(function (el) { el.textContent = c; });
    var w = getWish().length;
    $$('[data-tw-wish-count]').forEach(function (el) { el.textContent = w; });
  }

  /* ------------------------------------------------------------------- mode */
  function toast(message) {
    var wrap = $('.tw-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'tw-toast-wrap';
      document.body.appendChild(wrap);
    }
    var t = document.createElement('div');
    t.className = 'tw-toast';
    t.innerHTML = I.check + '<span>' + esc(message) + '</span>';
    wrap.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  /* ------------------------------------------------------------ chrome (UI) */
  var NAV = [
    { key: 'home', label: 'Home', href: BASE + '/' },
    { key: 'collection', label: 'Shop', href: BASE + '/collection' },
    { key: 'custom-orders', label: 'Custom', href: BASE + '/custom-orders' },
    { key: 'how-to-shop', label: 'How to Shop', href: BASE + '/how-to-shop' },
    { key: 'loyalty', label: 'Loyalty', href: BASE + '/loyalty' },
    { key: 'tracking', label: 'Track', href: BASE + '/tracking' }
  ];

  function catSVG() {
    return '<svg viewBox="0 0 120 92" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M33 60V38c0-15 12-26 27-26s27 11 27 26v22" fill="#f3e5e4"/>' +
      '<path d="M38 32 31 11l17 11" fill="#f3e5e4"/>' +
      '<path d="M82 32 89 11 72 22" fill="#f3e5e4"/>' +
      '<path d="M48 45c2 2 5 2 7 0"/><path d="M65 45c2 2 5 2 7 0"/>' +
      '<path d="M60 50v4"/><path d="M60 54c-3 3-7 2-8-1M60 54c3 3 7 2 8-1"/>' +
      '<path d="M27 51c-7-1-9 5-3 7M93 51c7-1 9 5 3 7"/>' +
      '<path d="M27 51l-8-3M93 51l8-3"/>' +
      '<path d="M41 60v13a5 5 0 0 0 10 0v-6"/><path d="M79 60v13a5 5 0 0 1-10 0v-6"/>' +
      '</svg>';
  }

  function laceSVG() {
    return '<svg viewBox="0 0 1200 18" preserveAspectRatio="none" aria-hidden="true">' +
      '<defs><pattern id="tw-lace-pattern" width="34" height="18" patternUnits="userSpaceOnUse">' +
      '<path d="M0 2h34" stroke="currentColor" stroke-width="1" opacity=".5"/>' +
      '<path d="M0 4c8.5 0 8.5 9 17 9s8.5-9 17-9" fill="none" stroke="currentColor" stroke-width="1.1"/>' +
      '<circle cx="17" cy="12.5" r="1.4" fill="currentColor"/>' +
      '<circle cx="8.5" cy="7" r="1.2" fill="currentColor"/>' +
      '<circle cx="25.5" cy="7" r="1.2" fill="currentColor"/>' +
      '</pattern></defs>' +
      '<rect width="1200" height="18" fill="url(#tw-lace-pattern)"/></svg>';
  }

  function headerHTML(active) {
    var nav = NAV.map(function (n) {
      return '<a href="' + n.href + '"' + (n.key === active ? ' class="is-active"' : '') + '>' + n.label + '</a>';
    }).join('');
    var drawer = NAV.concat([{ key: 'policies', label: 'Policies', href: BASE + '/policies' }]).map(function (n) {
      return '<a href="' + n.href + '">' + n.label + '<span>\u2192</span></a>';
    }).join('');
    return '' +
      '<div class="tw-announce"><span class="tw-star">\u2726</span> Handmade to order \u2014 please allow 10\u201315 days for making &amp; dispatch <span class="tw-star">\u2726</span></div>' +
      '<header class="tw-header">' +
        '<div class="tw-header-row">' +
          '<button class="tw-menu-btn" id="tw-menu-open" aria-label="Open menu" aria-expanded="false">' + I.menu + '</button>' +
          '<a class="tw-logo" href="' + BASE + '/">Mellowluv<span class="tw-logo-star">\u2726</span></a>' +
          '<nav class="tw-nav" aria-label="Test website navigation">' + nav + '</nav>' +
          '<div class="tw-actions">' +
            '<a class="tw-action" href="' + BASE + '/collection?focus=search" aria-label="Search">' + I.search + '</a>' +
            '<a class="tw-action" href="' + BASE + '/collection?wishlist=1" aria-label="Wishlist">' + I.heart + '<span class="tw-cart-count" data-tw-wish-count>0</span></a>' +
            '<a class="tw-action" href="' + BASE + '/cart" aria-label="Shopping bag">' + I.bag + '<span class="tw-cart-count" data-tw-cart-count>0</span></a>' +
          '</div>' +
        '</div>' +
        '<div class="tw-lace">' + laceSVG() + '</div>' +
        '<div class="tw-cat">' + catSVG() + '</div>' +
      '</header>' +
      '<div class="tw-scrim" id="tw-scrim"></div>' +
      '<aside class="tw-drawer" id="tw-drawer" aria-hidden="true" aria-label="Menu">' +
        '<div class="tw-drawer-head">' +
          '<span class="tw-drawer-title">Mellowluv</span>' +
          '<button class="tw-drawer-close" id="tw-menu-close" aria-label="Close menu">' + I.close + '</button>' +
        '</div>' +
        '<nav>' + drawer + '</nav>' +
        '<div class="tw-drawer-foot">' +
          '<p>A handmade jewellery studio.</p>' +
          '<p style="margin-top:8px;">Instagram \u2014 @mellowluvv_</p>' +
          '<p>nishthapanchal287@gmail.com</p>' +
          '<p style="margin-top:14px;color:var(--tw-plum);font-weight:600;letter-spacing:.1em;text-transform:uppercase;font-size:10px;">Design preview \u00B7 test website</p>' +
        '</div>' +
      '</aside>';
  }

  function footerHTML() {
    return '' +
      '<footer class="tw-footer">' +
        '<div class="tw-container">' +
          '<div class="tw-footer-grid">' +
            '<div class="tw-footer-brand">' +
              '<h3>Mellowluv</h3>' +
              '<p>Thoughtfully handmade jewellery for everyday moments. Small-batch pieces, custom ideas and stories you can wear.</p>' +
              '<div class="tw-footer-links" style="margin-top:14px;">' +
                '<a href="https://instagram.com/mellowluvv_" target="_blank" rel="noopener">Instagram \u2014 @mellowluvv_</a>' +
                '<a href="mailto:nishthapanchal287@gmail.com">nishthapanchal287@gmail.com</a>' +
                '<span style="font-size:12px;color:var(--tw-taupe);">Store run by Nishtha Panchal</span>' +
              '</div>' +
            '</div>' +
            '<div>' +
              '<h4>Shop</h4>' +
              '<div class="tw-footer-links">' +
                '<a href="' + BASE + '/collection">All jewellery</a>' +
                '<a href="' + BASE + '/custom-orders">Custom pieces</a>' +
                '<a href="' + BASE + '/cart">Your bag</a>' +
                '<a href="' + BASE + '/loyalty">Loyalty rewards</a>' +
              '</div>' +
            '</div>' +
            '<div>' +
              '<h4>Help</h4>' +
              '<div class="tw-footer-links">' +
                '<a href="' + BASE + '/how-to-shop">How to shop</a>' +
                '<a href="' + BASE + '/tracking">Track an order</a>' +
                '<a href="' + BASE + '/policies">Store policies</a>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="tw-footer-note">' +
            '<span>\u00A9 2026 Mellowluv. All rights reserved.</span>' +
            '<span class="tw-preview-tag">\u2726 Test Website \u2014 design preview</span>' +
            '<span>No real orders, payments or data are created here.</span>' +
          '</div>' +
        '</div>' +
      '</footer>';
  }

  var domReady = false;
  var queue = [];

  function ready(fn) {
    if (domReady) fn();
    else queue.push(fn);
  }

  function mountChrome() {
    var page = document.body.getAttribute('data-page') || '';
    var header = document.getElementById('tw-header-mount');
    if (header) header.innerHTML = headerHTML(page);
    var footer = document.getElementById('tw-footer-mount');
    if (footer) footer.innerHTML = footerHTML();

    var open = document.getElementById('tw-menu-open');
    var close = document.getElementById('tw-menu-close');
    var drawer = document.getElementById('tw-drawer');
    var scrim = document.getElementById('tw-scrim');
    function setDrawer(show) {
      if (!drawer || !scrim) return;
      drawer.classList.toggle('is-open', show);
      scrim.classList.toggle('is-open', show);
      drawer.setAttribute('aria-hidden', show ? 'false' : 'true');
      document.body.classList.toggle('tw-lock', show);
      if (open) open.setAttribute('aria-expanded', show ? 'true' : 'false');
    }
    if (open) open.addEventListener('click', function () { setDrawer(true); });
    if (close) close.addEventListener('click', function () { setDrawer(false); });
    if (scrim) scrim.addEventListener('click', function () { setDrawer(false); });
    $$('#tw-drawer a').forEach(function (a) { a.addEventListener('click', function () { setDrawer(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setDrawer(false); });

    syncBadges();
    syncWishes();
  }

  function mountDecos() {
    $$('[data-tw-deco]').forEach(function (el) {
      var key = el.getAttribute('data-tw-deco');
      el.innerHTML = DECOS[key] || DECOS.sprig;
    });
    $$('[data-tw-lace]').forEach(function (el) {
      el.innerHTML = laceSVG();
    });
  }

  /* ------------------------------------------------------------- components */
  function badge(p) {
    if (p.stock <= 0) return '<span class="tw-badge tw-badge--sold">Sold out</span>';
    if (p.offer_price) return '<span class="tw-badge tw-badge--plum">Offer</span>';
    if (p.stock <= 2) return '<span class="tw-badge tw-badge--olive">Only ' + p.stock + ' left</span>';
    if (p.id >= 60) return '<span class="tw-badge tw-badge--mauve">New in</span>';
    return '';
  }

  function priceHTML(p, large) {
    if (p.offer_price) {
      return '<span class="tw-price">' + money(p.offer_price) + ' <s>' + money(p.price) + '</s></span>';
    }
    return '<span class="tw-price"' + (large ? ' style="font-size:22px;"' : '') + '>' + money(p.price) + '</span>';
  }

  function productCard(p) {
    var href = BASE + '/product?id=' + p.id;
    var sold = p.stock <= 0;
    return '' +
      '<article class="tw-card">' +
        '<a class="tw-card-media" href="' + href + '" aria-label="' + esc(p.name) + '">' +
          '<img src="' + cld(p.image, 600) + '" alt="' + esc(p.name) + '" loading="lazy">' +
          badge(p) +
        '</a>' +
        '<button class="tw-wish" type="button" data-wish="' + p.id + '" aria-label="Save ' + esc(p.name) + ' to wishlist" aria-pressed="false">' + I.heart + '</button>' +
        '<div class="tw-card-body">' +
          '<a class="tw-card-name" href="' + href + '">' + esc(p.name) + '</a>' +
          '<div class="tw-card-foot">' +
            priceHTML(p) +
            (sold
              ? '<span class="tw-badge tw-badge--sold" style="position:static;">Sold</span>'
              : '<button class="tw-iconbtn" type="button" data-add="' + p.id + '" aria-label="Add ' + esc(p.name) + ' to bag">' + I.plus + '</button>') +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function renderGrid(el, list, emptyText) {
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<div class="tw-empty" style="width:100%;">' +
        '<span class="tw-deco" data-tw-deco="bloom"></span>' +
        '<p>' + esc(emptyText || 'Nothing here just yet.') + '</p></div>';
      mountDecos();
      return;
    }
    el.innerHTML = list.map(productCard).join('');
    syncWishes();
  }

  /* ---------------------------------------------------------------- timeline */
  var STAGES = [
    { t: 'Order placed', d: 'Your details reached the studio.' },
    { t: 'Payment verified', d: 'Your UPI payment was checked and confirmed.' },
    { t: 'Processing', d: 'Your piece is being made by hand.' },
    { t: 'Dispatched', d: 'Handed over to the courier with tracking.' },
    { t: 'Out for delivery', d: 'The parcel is on its way to you.' },
    { t: 'Delivered', d: 'Enjoy your little piece with a story.' }
  ];

  function timelineHTML(current, createdAt) {
    return '<ul class="tw-timeline">' + STAGES.map(function (s, i) {
      var cls = i < current ? 'is-done' : (i === current ? 'is-current' : '');
      var time = '';
      if (i < current) time = '<time>' + dateLabel(i - current) + '</time>';
      else if (i === current) time = '<time>In progress</time>';
      return '<li class="tw-tl ' + cls + '">' +
        '<span class="tw-tl-dot">' + (i < current ? I.check : '') + '</span>' +
        '<h4>' + s.t + '</h4><p>' + s.d + '</p>' + time +
        '</li>';
    }).join('') + '</ul>';
  }

  /* ------------------------------------------------------------------ orders */
  function getOrders() {
    var o = read(ORDERS_KEY, []);
    return Array.isArray(o) ? o : [];
  }
  function saveOrder(order) {
    var orders = getOrders();
    orders.unshift(order);
    write(ORDERS_KEY, orders.slice(0, 20));
  }
  function newOrderId() {
    return 'TW-' + Date.now().toString(36).toUpperCase().slice(-6);
  }
  function getDraft() { return read(DRAFT_KEY, null); }
  function saveDraft(d) { write(DRAFT_KEY, d); }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  /* ------------------------------------------------------ preference notes */
  function getNotes() {
    var n = read(NOTES_KEY, {});
    return n && typeof n === 'object' ? n : {};
  }
  function getNote(id) { return getNotes()[String(id)] || ''; }
  function setNote(id, text) {
    var notes = getNotes();
    if (text) notes[String(id)] = text;
    else delete notes[String(id)];
    write(NOTES_KEY, notes);
  }
  function clearNotes() { try { localStorage.removeItem(NOTES_KEY); } catch (e) {} }

  /* ---------------------------------------------------------------- loyalty */
  function getPoints() {
    var v = read(LOYALTY_KEY, null);
    return typeof v === 'number' ? v : 240;
  }
  function setPoints(n) { write(LOYALTY_KEY, Math.max(0, n)); }

  /* -------------------------------------------------------------------- init */
  document.addEventListener('DOMContentLoaded', function () {
    domReady = true;
    mountChrome();
    mountDecos();
    queue.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
    queue = [];
  });

  document.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]');
    if (add) {
      var id = Number(add.getAttribute('data-add'));
      productById(id).then(function (p) {
        if (p) addToCart(p, 1);
        else toast('This piece is unavailable');
      });
      return;
    }
    var wish = e.target.closest('[data-wish]');
    if (wish) { toggleWish(wish.getAttribute('data-wish')); return; }

    var acc = e.target.closest('.tw-acc-btn');
    if (acc) {
      var item = acc.closest('.tw-acc-item');
      var openNow = item.classList.toggle('is-open');
      acc.setAttribute('aria-expanded', openNow ? 'true' : 'false');
      return;
    }
    var toggle = e.target.closest('[data-tw-toggle]');
    if (toggle) {
      var target = document.querySelector(toggle.getAttribute('data-tw-toggle'));
      if (target) {
        var show = target.hasAttribute('hidden');
        if (show) target.removeAttribute('hidden');
        else target.setAttribute('hidden', '');
        toggle.textContent = show ? 'Read less' : 'Read more';
      }
    }
  });

  /* ------------------------------------------------------------------ export */
  window.TW = {
    BASE: BASE,
    ICONS: I,
    ready: ready,
    esc: esc,
    money: money,
    cld: cld,
    products: products,
    productById: productById,
    productCard: productCard,
    renderGrid: renderGrid,
    badge: badge,
    addToCart: addToCart,
    getCart: getCart,
    updateQty: updateQty,
    removeItem: removeItem,
    clearCart: clearCart,
    totals: totals,
    cartCount: cartCount,
    getWish: getWish,
    isWished: isWished,
    toggleWish: toggleWish,
    syncBadges: syncBadges,
    syncWishes: syncWishes,
    toast: toast,
    mountDecos: mountDecos,
    timelineHTML: timelineHTML,
    STAGES: STAGES,
    getOrders: getOrders,
    saveOrder: saveOrder,
    newOrderId: newOrderId,
    getDraft: getDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    getPoints: getPoints,
    setPoints: setPoints,
    getNotes: getNotes,
    getNote: getNote,
    setNote: setNote,
    clearNotes: clearNotes,
    SHIPPING: SHIPPING,
    URGENT_FEE: URGENT_FEE,
    dateLabel: dateLabel
  };
})();
