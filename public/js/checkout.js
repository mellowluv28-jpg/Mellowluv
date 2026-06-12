let currentProduct = null;
let cartData = null;
let loyaltyData = null;
let cachedShippingThrift = null;
let cachedShippingJewelry = null;

function getShippingForCategory(category) {
  if (category === 'thrift') return cachedShippingThrift || 50;
  return cachedShippingJewelry || 70;
}

function getMaxShippingForItems(items) {
  let max = 0;
  for (const item of items) {
    const cat = item.category === 'thrift' ? 'thrift' : 'jewelry';
    const rate = getShippingForCategory(cat);
    if (rate > max) max = rate;
  }
  return max || getShippingForCategory('jewelry');
}

async function fetchShipping() {
  try {
    const r = await fetch('/api/public/shipping');
    const s = await r.json();
    cachedShippingThrift = parseFloat(s.shipping_charge_thrift) || 50;
    cachedShippingJewelry = parseFloat(s.shipping_charge_jewelry) || 70;
  } catch {
    cachedShippingThrift = 50;
    cachedShippingJewelry = 70;
    return false;
  }
}

async function lookupPincode(pincode) {
  const statusEl = document.getElementById('pincode-status');
  if (pincode.length !== 6) { statusEl.textContent = 'Enter 6 digits — city/state auto-fill when available'; statusEl.style.color = '#b5838d'; return; }
  try {
    const res = await fetch('https://api.postalpincode.in/pincode/' + pincode);
    const data = await res.json();
    if (data[0]?.Status === 'Success' && data[0].PostOffice?.length > 0) {
      const po = data[0].PostOffice[0];
      const cityInput = document.querySelector('[name="city"]');
      const stateInput = document.querySelector('[name="state"]');
      if (cityInput && !cityInput.value) cityInput.value = po.Division || po.District || po.Name;
      if (stateInput && !stateInput.value) stateInput.value = po.State;
      statusEl.textContent = '✅ Auto-filled from pincode';
      statusEl.style.color = '#2e7d32';
    } else {
      statusEl.textContent = '⚠️ Pincode not found, enter city/state manually';
      statusEl.style.color = '#d84315';
    }
  } catch {
    statusEl.textContent = 'Could not auto-fill, enter city/state manually';
    statusEl.style.color = '#b0878f';
  }
}

function restoreAddress(phone) {
  if (!phone || phone.length < 10) return;
  const saved = localStorage.getItem('mellowluv_addr_' + phone);
  if (!saved) return;
  try {
    const addr = JSON.parse(saved);
    const fields = { city: addr.city, state: addr.state, pincode: addr.pincode };
    for (const [name, value] of Object.entries(fields)) {
      const el = document.querySelector('[name="' + name + '"]');
      if (el && !el.value) el.value = value || '';
    }
    if (addr.address && addr.address.includes(', ')) {
      const parts = addr.address.split(', ');
      const houseEl = document.querySelector('[name="house"]');
      const streetEl = document.querySelector('[name="street"]');
      if (houseEl && !houseEl.value) houseEl.value = parts[0] || '';
      if (streetEl && !streetEl.value) streetEl.value = parts.slice(1).join(', ') || '';
    }
  } catch {}
}

function saveAddress(phone, address, city, state, pincode) {
  if (!phone || phone.length < 10) return;
  localStorage.setItem('mellowluv_addr_' + phone, JSON.stringify({ address, city, state, pincode }));
}

async function initCheckout() {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get('product');
  const cartParam = params.get('cart');

  await fetchShipping();

  document.querySelector('[name="phone"]')?.addEventListener('input', function() {
    checkLoyalty(this.value);
    restoreAddress(this.value);
  });

  document.querySelector('[name="pincode"]')?.addEventListener('input', function() {
    lookupPincode(this.value);
  });

  const savedPhone = localStorage.getItem('mellowluv_last_phone');
  if (savedPhone) {
    const phoneInput = document.querySelector('[name="phone"]');
    if (phoneInput && !phoneInput.value) {
      phoneInput.value = savedPhone;
      restoreAddress(savedPhone);
      checkLoyalty(savedPhone);
    }
  }

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
    updateSummary();
    document.querySelector('[name="quantity"]').addEventListener('input', () => updateSummary());
    document.querySelector('[name="urgency"]').addEventListener('change', () => updateSummary());
  } catch {
    document.getElementById('checkout-form').innerHTML = '<div class="loading">Error loading product.</div>';
  }
}

async function renderCartCheckout() {
  if (cachedShippingThrift === null || cachedShippingJewelry === null) await fetchShipping();
  const shipping = getMaxShippingForItems(cartData.items);

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
    if (cachedShippingThrift !== null && cachedShippingJewelry !== null) { updateCartSummary(getMaxShippingForItems(cartData.items)); return; }
    fetchShipping().then(() => updateCartSummary(getMaxShippingForItems(cartData.items)));
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
  const cat = currentProduct.category === 'thrift' ? 'thrift' : 'jewelry';

  if (cachedShippingThrift === null || cachedShippingJewelry === null) {
    fetchShipping().then(() => updateSummary());
    return;
  }
  const shipping = getShippingForCategory(cat);
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
  if (!formData.get('house')?.trim()) { alert('House / Building / Apartment is required.'); return false; }
  if (!formData.get('street')?.trim()) { alert('Street / Area / Landmark is required.'); return false; }
  if (!formData.get('city')?.trim()) { alert('City is required.'); return false; }
  if (!formData.get('state')?.trim()) { alert('State is required.'); return false; }
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
    address: (formData.get('house') || '') + ', ' + (formData.get('street') || ''),
    city: formData.get('city'),
    state: formData.get('state'),
    pincode: formData.get('pincode'),
    urgency: formData.get('urgency'),
    aesthetics: formData.get('aesthetics'),
    extra_note: formData.get('extra_note')
  };

  saveAddress(data.phone, data.address, data.city, data.state, data.pincode);
  localStorage.setItem('mellowluv_last_phone', data.phone);

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
