let currentProduct = null;
let cartData = null;
let loyaltyData = null;
let cachedShipping = null;

async function initCheckout() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('product');
  const cartParam = params.get('cart');

  document.querySelector('[name="phone"]')?.addEventListener('input', function() {
    checkLoyalty(this.value);
  });

  if (cartParam === '1') {
    const raw = localStorage.getItem('mellowluv_cart');
    if (!raw) { document.getElementById('checkout-form').innerHTML = '<div class="loading">Your cart is empty. <a href="/">Go back</a></div>'; return; }
    cartData = JSON.parse(raw);
    if (!cartData.items || cartData.items.length === 0) { document.getElementById('checkout-form').innerHTML = '<div class="loading">Your cart is empty. <a href="/">Go back</a></div>'; return; }
    renderCartCheckout();
    return;
  }

  if (!productId) {
    document.getElementById('checkout-form').innerHTML = '<div class="loading">No product selected. <a href="/">Go back</a></div>';
    return;
  }
  try {
    const res = await fetch(`/api/products/${productId}`);
    currentProduct = await res.json();
    if (!currentProduct || currentProduct.error) {
      document.getElementById('checkout-form').innerHTML = '<div class="loading">Product not found. <a href="/">Go back</a></div>';
      return;
    }
    const shippingRes = await fetch('/api/admin/settings');
    try { const s = await shippingRes.json(); cachedShipping = parseFloat(s.shipping_charge) || 50; } catch { cachedShipping = 50; }
    updateSummary();
    document.querySelector('[name="quantity"]').addEventListener('input', () => updateSummary());
    document.querySelector('[name="urgency"]').addEventListener('change', () => updateSummary());
  } catch {
    document.getElementById('checkout-form').innerHTML = '<div class="loading">Error loading product.</div>';
  }
}

async function renderCartCheckout() {
  if (cachedShipping === null) {
    try { const r = await fetch('/api/admin/settings'); const s = await r.json(); cachedShipping = parseFloat(s.shipping_charge) || 50; } catch { cachedShipping = 50; }
  }
  let shipping = cachedShipping;

  document.getElementById('order-form').querySelector('[name="quantity"]')?.remove();
  const html = cartData.items.map((item, i) => `<div style="margin-bottom:8px;padding:8px 12px;background:#fff8f9;border-radius:10px;border:1px solid #f5d6de;"><strong>${item.name}</strong> × ${item.qty} — ₹${(item.offer_price || item.price) * item.qty}</div>`).join('');
  document.getElementById('order-summary').innerHTML = `<h3>🛒 Cart Items (${cartData.items.length})</h3>${html}<div id="cart-total-display"></div>`;
  document.getElementById('checkout-form').style.display = 'block';
  document.querySelector('[name="urgency"]').addEventListener('change', () => updateCartSummary(shipping));
  updateCartSummary(shipping);
}

function updateCartSummary(shipping) {
  if (!cartData) return;
  if (shipping === undefined) {
    if (cachedShipping !== null) { updateCartSummary(cachedShipping); return; }
    fetch('/api/admin/settings').then(r => r.json()).then(s => { cachedShipping = parseFloat(s.shipping_charge) || 50; updateCartSummary(cachedShipping); });
    return;
  }
  const urgency = document.querySelector('[name="urgency"]')?.value || '';
  const extra = urgency === 'urgent' ? 50 : 0;
  let subtotal = 0;
  let maxItemValue = 0;
  cartData.items.forEach(item => {
    const up = (item.offer_price && item.offer_price > 0) ? item.offer_price : item.price;
    subtotal += up * item.qty;
    const val = up * item.qty;
    if (val > maxItemValue) maxItemValue = val;
  });
  const discountAmt = (loyaltyData && loyaltyData.discount_eligible) ? Math.round(maxItemValue * 0.5) : 0;
  const total = subtotal + shipping + extra - discountAmt;
  document.getElementById('cart-total-display').innerHTML = `
    <div class="total-line"><span>Subtotal</span><span>₹${subtotal}</span></div>
    ${discountAmt > 0 ? `<div class="total-line" style="color:#2e7d32;"><span>🎉 50% Loyalty Discount</span><span>-₹${discountAmt}</span></div>` : ''}
    <div class="total-line"><span>Shipping</span><span>₹${shipping}</span></div>
    ${extra ? `<div class="total-line"><span>⚡ Urgent Surcharge</span><span>+₹50</span></div>` : ''}
    <div class="total-line grand"><span>Total</span><span>₹${total}</span></div>`;
}

function updateSummary() {
  if (!currentProduct) return;
  const qty = parseInt(document.querySelector('[name="quantity"]')?.value) || 1;
  const urgency = document.querySelector('[name="urgency"]')?.value || '';
  const extra = urgency === 'urgent' ? 50 : 0;
  const unitPrice = (currentProduct.offer_price && currentProduct.offer_price > 0) ? currentProduct.offer_price : currentProduct.price;
  const hasOffer = currentProduct.offer_price && currentProduct.offer_price > 0;

  if (cachedShipping === null) {
    fetch('/api/admin/settings').then(r => r.json()).then(s => {
      cachedShipping = parseFloat(s.shipping_charge) || 50;
      updateSummary();
    });
    return;
  }
  const shipping = cachedShipping;
  const subtotal = unitPrice * qty;
  const discountAmt = (loyaltyData && loyaltyData.discount_eligible) ? Math.round(subtotal * 0.5) : 0;
  const total = subtotal + shipping + extra - discountAmt;
  document.getElementById('order-summary').innerHTML = `
    <h3>Order Summary</h3>
    <div style="margin-bottom:12px;">
      <div style="font-weight:600;color:#5a4a4a;">${currentProduct.name}</div>
      <div style="color:#b5838d;font-size:13px;">${hasOffer ? `<span style="text-decoration:line-through;">₹${currentProduct.price}</span> <strong style="color:#d84315;">₹${unitPrice}</strong>` : `₹${unitPrice}`} × ${qty}</div>
    </div>
    <div class="total-line"><span>Subtotal</span><span>₹${subtotal}</span></div>
    ${discountAmt > 0 ? `<div class="total-line" style="color:#2e7d32;"><span>🎉 50% Loyalty Discount</span><span>-₹${discountAmt}</span></div>` : ''}
    <div class="total-line"><span>Shipping</span><span>₹${shipping}</span></div>
    ${extra ? `<div class="total-line"><span>⚡ Urgent Surcharge</span><span>+₹50</span></div>` : ''}
    <div class="total-line grand"><span>Total</span><span>₹${total}</span></div>`;
}

async function checkLoyalty(phone) {
  const infoEl = document.getElementById('loyalty-info');
  if (!infoEl) return;
  if (!phone || phone.length < 10) { loyaltyData = null; infoEl.style.display = 'none'; if (typeof updateSummary === 'function') updateSummary(); if (typeof updateCartSummary === 'function') updateCartSummary(); return; }
  try {
    const res = await fetch('/api/loyalty/check?phone=' + encodeURIComponent(phone));
    const data = await res.json();
    if (data.total_loyalty_score === undefined) { loyaltyData = null; infoEl.style.display = 'none'; return; }
    loyaltyData = data;
    const nextIn = data.orders_until_discount;
    const discountReady = data.discount_eligible;
    infoEl.style.display = 'block';
    const earnMsg = '<div style="margin-top:6px;font-size:12px;color:#b0878f;">⭐ You\'ll earn <strong>1 loyalty point</strong> from this order!</div>';
    if (discountReady) {
      infoEl.innerHTML = '<div style="background:#e8f5e9;border:2px solid #a5d6a7;border-radius:12px;padding:12px;margin-bottom:14px;font-size:13px;color:#2e7d32;"><strong>🎉</strong> You\'re eligible for <strong>50% OFF</strong> on your most expensive item this order!</div>' + earnMsg;
    } else {
      infoEl.innerHTML = '<div style="background:#fff8e1;border:2px solid #ffe082;border-radius:12px;padding:12px;margin-bottom:14px;font-size:13px;color:#5a4a4a;"><strong>⭐</strong> <strong>' + nextIn + ' more order(s)</strong> to unlock <strong>50% OFF</strong> on your most expensive item!</div>' + earnMsg;
    }
    if (typeof updateSummary === 'function') updateSummary();
    if (typeof updateCartSummary === 'function') updateCartSummary();
  } catch { loyaltyData = null; infoEl.style.display = 'none'; }
}

function validateForm(formData) {
  const phone = formData.get('phone');
  if (!/^[0-9]{10}$/.test(phone)) { alert('Phone number must be exactly 10 digits.'); return false; }
  const pincode = formData.get('pincode');
  if (!/^[0-9]{6}$/.test(pincode)) { alert('Pincode must be exactly 6 digits.'); return false; }
  const instagram = formData.get('instagram');
  if (!instagram || !instagram.trim()) { alert('Instagram handle is required.'); return false; }
  return true;
}

async function placeOrder(event) {
  event.preventDefault();
  const form = document.getElementById('order-form');
  const formData = new FormData(form);
  if (!validateForm(formData)) return;

  const data = {
    customer_name: formData.get('customer_name'),
    phone: formData.get('phone'),
    instagram: formData.get('instagram'),
    address: formData.get('address'),
    pincode: formData.get('pincode'),
    urgency: formData.get('urgency'),
    aesthetics: formData.get('aesthetics'),
    extra_note: formData.get('extra_note')
  };

  if (cartData) {
    data.is_cart = true;
    data.cart_items = cartData.items.map(item => ({ id: item.id, qty: item.qty }));
    data.quantity = cartData.items.reduce((s, i) => s + i.qty, 0);
  } else {
    data.product_id = currentProduct.id;
    data.quantity = parseInt(formData.get('quantity')) || 1;
  }

  const submitBtn = form.querySelector('.btn-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Placing Order...';
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    if (result.success) {
      if (cartData) localStorage.removeItem('mellowluv_cart');
      const ci = result.contact_instagram ? `&ci=${encodeURIComponent(result.contact_instagram)}` : '';
      const loyaltyPts = result.loyalty ? result.loyalty.points : 0;
      const lp = `&lp=${loyaltyPts}&lw=1`;
      window.location.href = `/public/order-success.html?order=${result.order_id}&qr=${encodeURIComponent(result.qr_code)}&upi=${encodeURIComponent(result.upi_id)}&amount=${result.amount}${ci}${lp}`;
    } else {
      alert(result.error || 'Failed to place order');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Place Order 🌸';
    }
  } catch {
    alert('Network error. Please try again.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Place Order 🌸';
  }
}

window.addEventListener('DOMContentLoaded', initCheckout);
