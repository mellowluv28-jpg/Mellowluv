require('express-async-errors');
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { query, queryOne, execute } = require('./database');
const cloudinary = require('./cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;
const sseClients = [];
const adminSessions = new Map();
const loginAttempts = new Map();
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MINUTES = 15;

const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// --- Helper ---
async function getSetting(key) {
  const row = await queryOne('SELECT value FROM settings WHERE key = $1', [key]);
  if (row) return row.value;
  const envMap = {
    shipping_charge: process.env.SHIPPING_CHARGE || '50',
    upi_id: process.env.UPI_ID || '8401535686@fam',
    upi_name: process.env.UPI_NAME || 'Mellowluv',
    contact_phone: process.env.CONTACT_PHONE || '8401535686',
    contact_instagram: process.env.CONTACT_INSTAGRAM || '@mellowluvv_',
    admin_username: process.env.ADMIN_USERNAME || 'admin',
    admin_password: process.env.ADMIN_PASSWORD || 'admin123',
    ntfy_topic: process.env.NTFY_TOPIC || ''
  };
  return envMap[key] || null;
}

// --- SSE ---
app.get('/api/admin/events', (req, res) => {
  const auth = req.headers.authorization || '';
  const token = (auth.startsWith('Bearer ') ? auth.split(' ')[1] : '') || req.query.token || '';
  const session = adminSessions.get(token);
  if (!session || Date.now() - session.createdAt > SESSION_DURATION) return res.status(401).json({ error: 'Unauthorized' });
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.write('data: {"type":"connected"}\n\n');
  sseClients.push(res);
  res.on('close', () => { const idx = sseClients.indexOf(res); if (idx > -1) sseClients.splice(idx, 1); });
});

async function notifyNewOrder(order) {
  const data = JSON.stringify({ type: 'new_order', order: { id: order.id, customer_name: order.customer_name, product_name: order.product_name, total: order.total, phone: order.phone } });
  sseClients.forEach(c => c.write('data: ' + data + '\n\n'));
}

function parseOrderItems(order) {
  const note = order.extra_note || '';
  const itemsMatch = note.match(/Items:\s*(\[.*\])$/);
  if (itemsMatch) {
    try { return JSON.parse(itemsMatch[1]); } catch {}
  }
  if (order.product_id && order.quantity) return [{ id: order.product_id, qty: order.quantity }];
  return [];
}

function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.split(' ')[1];
  const session = adminSessions.get(token);
  if (!session) return res.status(401).json({ error: 'Unauthorized' });
  if (Date.now() - session.createdAt > SESSION_DURATION) {
    adminSessions.delete(token);
    return res.status(401).json({ error: 'Session expired' });
  }
  next();
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Customer Auth ---
async function customerAuth(req, res, next) {
  const token = req.headers['x-customer-token'];
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  const customer = await queryOne('SELECT * FROM customers WHERE token = $1', [token]);
  if (!customer) return res.status(401).json({ error: 'Invalid session' });
  req.customer = customer;
  next();
}

app.post('/api/customer/signup', async (req, res) => {
  const { name, phone, password } = req.body;
  if (!name || !phone || !password) return res.status(400).json({ error: 'Name, phone, and password required' });
  if (!/^[0-9]{10}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone number' });
  if (password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  const existing = await queryOne('SELECT * FROM customers WHERE phone = $1', [phone]);
  if (existing) return res.status(400).json({ error: 'Phone already registered. Login instead.' });
  const token = 'cust_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  await execute('INSERT INTO customers (phone, name, password, token, loyalty_points, discount_used) VALUES ($1, $2, $3, $4, 0, 0)', [phone, name, password, token]);
  res.json({ success: true, token, customer: { phone, name } });
});

app.post('/api/customer/login', async (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Phone and password required' });
  const customer = await queryOne('SELECT * FROM customers WHERE phone = $1 AND password = $2', [phone, password]);
  if (!customer) return res.status(401).json({ error: 'Invalid phone or password' });
  const token = 'cust_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  await execute('UPDATE customers SET token = $1 WHERE phone = $2', [token, phone]);
  res.json({ success: true, token, customer: { phone: customer.phone, name: customer.name } });
});

app.post('/api/customer/logout', customerAuth, (req, res) => {
  execute('UPDATE customers SET token = NULL WHERE phone = $1', [req.customer.phone]);
  res.json({ success: true });
});

app.get('/api/customer/session', async (req, res) => {
  const token = req.headers['x-customer-token'];
  if (!token) return res.json({ loggedIn: false });
  const customer = await queryOne('SELECT * FROM customers WHERE token = $1', [token]);
  if (!customer) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, customer: { phone: customer.phone, name: customer.name } });
});

// --- Loyalty ---
async function ensureCustomer(phone, name) {
  const existing = await queryOne('SELECT * FROM customers WHERE phone = $1', [phone]);
  if (!existing) {
    await execute('INSERT INTO customers (phone, name, loyalty_points, discount_used) VALUES ($1, $2, 0, 0)', [phone, name || '']);
  }
}

async function getLoyaltyInfo(phone) {
  const result = await queryOne("SELECT COALESCE(SUM(loyalty_award), 0) as total FROM orders WHERE phone = $1 AND payment_status = 'verified'", [phone]);
  const totalScore = result?.total || 0;
  return {
    total_loyalty_score: totalScore,
    points_toward_next_discount: totalScore % 4,
    orders_until_discount: 3 - (totalScore % 4),
    discount_eligible: totalScore > 0 && totalScore % 4 === 3,
    prebook_eligible: totalScore > 1
  };
}

app.get('/api/loyalty/check', async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'Phone number required' });
  await ensureCustomer(phone);
  const info = await getLoyaltyInfo(phone);
  const customer = await queryOne('SELECT name, loyalty_points FROM customers WHERE phone = $1', [phone]);
  res.json({ ...info, name: customer?.name || '' });
});

app.post('/api/prebook', async (req, res) => {
  const { customer_name, phone, instagram, address, pincode, product_id, urgency, whatsapp_optin } = req.body;
  if (!customer_name || !phone || !address || !pincode || !product_id) return res.status(400).json({ error: 'Missing required fields' });
  const info = await getLoyaltyInfo(phone);
  if (!info.prebook_eligible) return res.status(403).json({ error: `Not eligible for pre-booking. You need ${Math.max(0, 2 - info.total_loyalty_score)} more purchase(s) to unlock pre-booking.`, loyalty: info });
  const product = await queryOne('SELECT * FROM products WHERE id = $1', [product_id]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!product.scheduled_at || new Date(product.scheduled_at) <= new Date()) return res.status(400).json({ error: 'This product is already available for regular purchase.' });
  const unitPrice = (product.offer_price && product.offer_price > 0) ? product.offer_price : product.price;
  const shipping = parseFloat(await getSetting('shipping_charge'));
  const prebookCharge = 50;
  const total = unitPrice + prebookCharge + shipping;
  const category = product.category === 'jewelry' ? 'mellowluv' : 'thrift';
  const result = await execute(
    "INSERT INTO orders (customer_name, phone, instagram, address, pincode, urgency, aesthetics, extra_note, quantity, product_id, product_name, product_price, product_category, shipping_charge, total, payment_status, tracking_status, discount_applied, is_prebook, loyalty_award, whatsapp_optin) VALUES ($1, $2, $3, $4, $5, $6, '', '', 1, $7, $8, $9, $10, $11, $12, 'unpaid', 'unverified', 0, 1, 2, $13)",
    [customer_name, phone, instagram || '', address, pincode, urgency || '', product_id, product.name, product.price, category, shipping, Math.round(total), whatsapp_optin ? 1 : 0]
  );
  const upiId = await getSetting('upi_id');
  const upiName = await getSetting('upi_name');
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${Math.round(total)}&tn=Order%20%23${result.lastInsertRowid}&cu=INR`;
  const qrDataUrl = await QRCode.toDataURL(upiLink);
  const contactInsta = await getSetting('contact_instagram');
  res.json({
    success: true,
    order_id: result.lastInsertRowid,
    qr_code: qrDataUrl,
    upi_id: upiId,
    amount: Math.round(total),
    contact_instagram: contactInsta,
    is_prebook: true,
    loyalty: { points: info.total_loyalty_score, will_earn: 2, orders_until_discount: info.orders_until_discount, prebook_eligible: info.prebook_eligible }
  });
});

// --- Orders ---
app.post('/api/orders', async (req, res) => {
  const { customer_name, phone, instagram, address, pincode, urgency, aesthetics, extra_note, product_id, quantity, is_cart, cart_items, whatsapp_optin } = req.body;
  if (!customer_name || !phone || !address || !pincode) return res.status(400).json({ error: 'Missing required fields' });
  await ensureCustomer(phone, customer_name);

  if (is_cart && cart_items && cart_items.length > 0) {
    let extraCharge = 0;
    let totalBeforeExtra = 0;
    let shipping = parseFloat(await getSetting('shipping_charge'));
    let allItems = [];
    for (const item of cart_items) {
      const product = await queryOne('SELECT * FROM products WHERE id = $1', [item.id]);
      if (!product) return res.status(404).json({ error: `Product not found: ${item.id}` });
      if (product.stock < item.qty) return res.status(400).json({ error: `Not enough stock for ${product.name}` });
      if (product.scheduled_at && new Date(product.scheduled_at) > new Date()) return res.status(400).json({ error: `${product.name} is not available yet.` });
      const unitPrice = (product.offer_price && product.offer_price > 0) ? product.offer_price : product.price;
      const lineTotal = unitPrice * item.qty;
      totalBeforeExtra += lineTotal;
      const category = product.category === 'jewelry' ? 'mellowluv' : 'thrift';
      allItems.push({ product, qty: item.qty, unitPrice, lineTotal, category });
    }

    if (urgency === 'urgent') extraCharge += 30;

    const loyaltyInfo = await getLoyaltyInfo(phone);
    let discountAmount = 0;
    let discountedItemIndex = -1;
    if (loyaltyInfo.discount_eligible) {
      let maxVal = 0;
      allItems.forEach((item, idx) => {
        const val = item.unitPrice * item.qty;
        if (val > maxVal) { maxVal = val; discountedItemIndex = idx; }
      });
      if (discountedItemIndex >= 0) {
        discountAmount = Math.round((allItems[discountedItemIndex].unitPrice * allItems[discountedItemIndex].qty) * 0.5);
      }
    }

    const grandTotal = totalBeforeExtra + shipping + extraCharge - discountAmount;

    for (const item of allItems) {
      const product = await queryOne('SELECT stock FROM products WHERE id = $1', [item.product.id]);
      if (!product || product.stock < item.qty) {
        return res.status(400).json({ error: `Not enough stock for ${item.product.name}` });
      }
    }

    const totalQty = allItems.reduce((s, i) => s + i.qty, 0);
    const itemNames = allItems.map(i => i.product.name).join(', ');
    const cats = [...new Set(allItems.map(i => i.product.category))];
    const mainCat = cats.length === 1 ? cats[0] : 'mixed';
    const category = mainCat === 'jewelry' ? 'mellowluv' : (mainCat === 'mixed' ? 'mixed' : 'thrift');
    const itemsJson = JSON.stringify(allItems.map(i => ({ id: i.product.id, name: i.product.name, qty: i.qty, price: i.unitPrice })));
    const cartNote = extra_note ? extra_note + ' | Items: ' + itemsJson : 'Items: ' + itemsJson;

    const result = await execute(
      "INSERT INTO orders (customer_name, phone, instagram, address, pincode, urgency, aesthetics, extra_note, quantity, product_id, product_name, product_price, product_category, shipping_charge, total, payment_status, tracking_status, discount_applied, whatsapp_optin) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15, 'unpaid', 'unverified', $16, $17)",
      [customer_name, phone, instagram, address, pincode, urgency || '', aesthetics || '', cartNote, totalQty, allItems[0].product.id, 'Cart (' + allItems.length + ' items): ' + itemNames, allItems[0].product.price, category, shipping, Math.round(grandTotal), discountAmount > 0 ? 1 : 0, whatsapp_optin ? 1 : 0]
    );
    const firstOrderId = result.lastInsertRowid;

    const newCartOrder = await queryOne('SELECT * FROM orders WHERE id = $1', [firstOrderId]);
    if (newCartOrder) await notifyNewOrder(newCartOrder);

    const upiId = await getSetting('upi_id');
    const upiName = await getSetting('upi_name');
    const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${Math.round(grandTotal)}&tn=Order%20%23${firstOrderId}&cu=INR`;
    const qrDataUrl = await QRCode.toDataURL(upiLink);
    const contactInsta = await getSetting('contact_instagram');

    return res.json({
      success: true, order_id: firstOrderId, qr_code: qrDataUrl, upi_id: upiId,
      amount: Math.round(grandTotal), contact_instagram: contactInsta,
      is_cart: true, items: allItems.length, extra_charge: extraCharge, discount_applied: discountAmount > 0,
      loyalty: { points: loyaltyInfo.total_loyalty_score, will_earn: 1, orders_until_discount: loyaltyInfo.orders_until_discount, prebook_eligible: loyaltyInfo.prebook_eligible }
    });
  }

  if (!product_id) return res.status(400).json({ error: 'Missing product_id' });
  const qty = parseInt(quantity) || 1;
  if (qty < 1) return res.status(400).json({ error: 'Invalid quantity' });

  const product = await queryOne('SELECT * FROM products WHERE id = $1', [product_id]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.scheduled_at && new Date(product.scheduled_at) > new Date()) {
    return res.status(400).json({ error: 'This product is not available yet.' });
  }

  const productCheck = await queryOne('SELECT stock FROM products WHERE id = $1', [product_id]);
  if (!productCheck || productCheck.stock < qty) return res.status(400).json({ error: 'Not enough stock' });

  let extraCharge = 0;
  if (urgency === 'urgent') extraCharge += 30;

  const shipping = parseFloat(await getSetting('shipping_charge'));
  const unitPrice = (product.offer_price && product.offer_price > 0) ? product.offer_price : product.price;
  let total = (unitPrice * qty) + shipping + extraCharge;
  const category = product.category === 'jewelry' ? 'mellowluv' : 'thrift';

  const loyaltyInfo = await getLoyaltyInfo(phone);
  let discountApplied = 0;
  if (loyaltyInfo.discount_eligible) {
    const discountHalf = Math.round((unitPrice * qty) * 0.5);
    total -= discountHalf;
    discountApplied = 1;
  }

  const result = await execute(
    "INSERT INTO orders (customer_name, phone, instagram, address, pincode, urgency, aesthetics, extra_note, quantity, product_id, product_name, product_price, product_category, shipping_charge, total, payment_status, tracking_status, discount_applied, whatsapp_optin) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'unpaid', 'unverified', $16, $17)",
    [customer_name, phone, instagram, address, pincode, urgency || '', aesthetics || '', extra_note || '', qty, product_id, product.name, product.price, category, shipping, Math.round(total), discountApplied, whatsapp_optin ? 1 : 0]
  );

  const newOrder = await queryOne('SELECT * FROM orders WHERE id = $1', [result.lastInsertRowid]);
  if (newOrder) await notifyNewOrder(newOrder);

  const upiId = await getSetting('upi_id');
  const upiName = await getSetting('upi_name');
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${Math.round(total)}&tn=Order%20%23${result.lastInsertRowid}&cu=INR`;
  const qrDataUrl = await QRCode.toDataURL(upiLink);
  const contactInsta = await getSetting('contact_instagram');

  res.json({
    success: true,
    order_id: result.lastInsertRowid,
    qr_code: qrDataUrl,
    upi_id: upiId,
    amount: Math.round(total),
    contact_instagram: contactInsta,
    extra_charge: extraCharge,
    discount_applied: discountApplied === 1,
    loyalty: { points: loyaltyInfo.total_loyalty_score, will_earn: 1, orders_until_discount: loyaltyInfo.orders_until_discount, prebook_eligible: loyaltyInfo.prebook_eligible }
  });
});

app.get('/api/orders/by-phone', async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });
  const orders = await query('SELECT * FROM orders WHERE phone = $1 ORDER BY created_at DESC', [phone]);
  res.json(orders);
});

app.get('/api/orders/track', async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'Phone number is required' });
  const orders = await query('SELECT id, customer_name, product_name, quantity, total, status, payment_status, tracking_status, tracking_id, product_category, created_at FROM orders WHERE phone = $1 ORDER BY created_at DESC', [phone]);
  if (orders.length === 0) return res.status(404).json({ error: 'No orders found for this phone number.' });
  res.json(orders);
});

app.get('/api/orders/:id', async (req, res) => {
  const order = await queryOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.put('/api/orders/:id/pay', async (req, res) => {
  const order = await queryOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.payment_status !== 'unpaid') return res.status(400).json({ error: 'Payment already marked' });
  await execute("UPDATE orders SET payment_status = 'paid' WHERE id = $1", [req.params.id]);
  const topic = await getSetting('ntfy_topic');
  if (topic) {
    try {
      const body = '💰 A customer has marked payment. Please verify it.';
      const req2 = https.request('https://ntfy.sh/' + encodeURIComponent(topic), { method: 'POST', headers: { 'Content-Type': 'text/plain' } });
      req2.write(body);
      req2.end();
    } catch {}
  }
  res.json({ success: true });
});

app.post('/api/orders/:id/upload-proof', async (req, res) => {
  const order = await queryOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.payment_status !== 'unpaid') return res.status(400).json({ error: 'Payment already submitted' });
  const { screenshot } = req.body;
  if (!screenshot) return res.status(400).json({ error: 'No screenshot provided' });
  const matches = screenshot.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return res.status(400).json({ error: 'Invalid image format' });
  const buffer = Buffer.from(matches[2], 'base64');
  const result = await cloudinary.uploadBuffer(buffer, 'payment_proofs');
  const items = parseOrderItems(order);
  for (const item of items) {
    const dec = await execute('UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1', [item.qty, item.id]);
    if (dec.changes === 0) {
      for (const restored of items) {
        if (restored.id === item.id) break;
        await execute('UPDATE products SET stock = stock + $1 WHERE id = $2', [restored.qty, restored.id]);
      }
      return res.status(400).json({ error: 'Not enough stock' });
    }
  }
  await execute("UPDATE orders SET payment_screenshot = $1, payment_status = 'paid', screenshot_uploaded_at = NOW() WHERE id = $2", [result.url, req.params.id]);
  const topic = await getSetting('ntfy_topic');
  if (topic) {
    try {
      const body = '📸 A customer has uploaded a payment screenshot. Please verify it.';
      const req2 = https.request('https://ntfy.sh/' + encodeURIComponent(topic), { method: 'POST', headers: { 'Content-Type': 'text/plain' } });
      req2.write(body);
      req2.end();
    } catch {}
  }
  res.json({ success: true });
});

app.post('/api/orders/:id/reject-proof', async (req, res) => {
  const order = await queryOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.payment_screenshot) {
    try { const m = order.payment_screenshot.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/); if (m) await cloudinary.deleteImage(m[1]); } catch {}
  }
  const items = parseOrderItems(order);
  for (const item of items) {
    await execute('UPDATE products SET stock = stock + $1 WHERE id = $2', [item.qty, item.id]);
  }
  await execute("UPDATE orders SET payment_screenshot = '', screenshot_uploaded_at = NULL, payment_status = 'unpaid' WHERE id = $1", [req.params.id]);
  res.json({ success: true, message: 'Screenshot rejected, order reverted to unpaid' });
});

// --- Admin ---
app.all('/api/admin/reset-credentials', async (req, res) => {
  const master_key = req.body?.master_key || req.query?.key || '';
  if (master_key !== 'mellowluv_reset_2026') return res.status(403).json({ error: 'Invalid key' });
  await execute("DELETE FROM settings WHERE key IN ('admin_username', 'admin_password')");
  res.json({ success: true, message: 'Credentials reset to admin/admin123' });
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const attempts = loginAttempts.get(username) || { count: 0, lockedUntil: 0 };
  if (Date.now() < attempts.lockedUntil) {
    const mins = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({ error: `Too many attempts. Try again in ${mins} minute(s).` });
  }
  const adminUser = await getSetting('admin_username');
  const adminPass = await getSetting('admin_password');
  if (username === adminUser && password === adminPass) {
    loginAttempts.delete(username);
    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.set(token, { createdAt: Date.now() });
    return res.json({ success: true, token });
  }
  attempts.count += 1;
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    attempts.lockedUntil = Date.now() + LOGIN_LOCKOUT_MINUTES * 60 * 1000;
    attempts.count = 0;
  }
  loginAttempts.set(username, attempts);
  res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/api/admin/dashboard', adminAuth, async (req, res) => {
  const totalOrders = await queryOne("SELECT COUNT(*) as count FROM orders");
  const totalRevenue = await queryOne("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE payment_status = 'verified'");
  const totalShipping = await queryOne("SELECT COALESCE(SUM(shipping_charge), 0) as total FROM orders WHERE payment_status = 'verified'");
  const paidOrders = await queryOne("SELECT COUNT(*) as count FROM orders WHERE payment_status = 'paid' OR payment_status = 'verified'");
  const unpaidOrders = await queryOne("SELECT COUNT(*) as count FROM orders WHERE payment_status = 'unpaid'");
  const orders = await query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 5");
  const mostSold = await query("SELECT product_name, SUM(quantity) as total_qty FROM orders WHERE payment_status = 'verified' GROUP BY product_name ORDER BY total_qty DESC LIMIT 5");
  const revenueData = await query("SELECT TO_CHAR(created_at, 'DD-MM') as date, SUM(total) as revenue FROM orders WHERE payment_status = 'verified' GROUP BY TO_CHAR(created_at, 'DD-MM') ORDER BY MIN(created_at) ASC LIMIT 30");
  const upcomingProducts = await query("SELECT * FROM products WHERE scheduled_at IS NOT NULL AND scheduled_at > NOW() ORDER BY scheduled_at ASC LIMIT 10");
  res.json({
    stats: {
      totalOrders: totalOrders?.count || 0, netRevenue: totalRevenue?.total || 0, totalShipping: totalShipping?.total || 0,
      paidOrders: paidOrders?.count || 0, unpaidOrders: unpaidOrders?.count || 0,
      urgentOrders: (await queryOne("SELECT COUNT(*) as count FROM orders WHERE urgency = 'urgent'"))?.count || 0,
      profit: totalRevenue?.total || 0, totalProducts: (await queryOne("SELECT COUNT(*) as count FROM products"))?.count || 0
    },
    recent_orders: orders, most_sold: mostSold, revenue_chart: revenueData, upcoming_products: upcomingProducts
  });
});

app.get('/api/admin/stats', adminAuth, async (req, res) => {
  const totalOrders = await queryOne("SELECT COUNT(*) as count FROM orders");
  const totalRevenue = await queryOne("SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE payment_status = 'verified'");
  const totalShipping = await queryOne("SELECT COALESCE(SUM(shipping_charge), 0) as total FROM orders WHERE payment_status = 'verified'");
  const paidOrders = await queryOne("SELECT COUNT(*) as count FROM orders WHERE payment_status = 'paid' OR payment_status = 'verified'");
  const unpaidOrders = await queryOne("SELECT COUNT(*) as count FROM orders WHERE payment_status = 'unpaid'");
  const urgentOrders = await queryOne("SELECT COUNT(*) as count FROM orders WHERE urgency = 'urgent'");
  const totalProducts = await queryOne("SELECT COUNT(*) as count FROM products");
  res.json({
    totalOrders: totalOrders?.count || 0, netRevenue: totalRevenue?.total || 0,
    totalShipping: totalShipping?.total || 0, paidOrders: paidOrders?.count || 0,
    unpaidOrders: unpaidOrders?.count || 0, urgentOrders: urgentOrders?.count || 0,
    profit: totalRevenue?.total || 0, totalProducts: totalProducts?.count || 0
  });
});

app.get('/api/admin/stats/daily-revenue', adminAuth, async (req, res) => {
  const revenueData = await query("SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as day, SUM(total) as revenue FROM orders WHERE payment_status = 'verified' AND created_at >= NOW() - INTERVAL '7 days' GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD') ORDER BY MIN(created_at) ASC");
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const found = revenueData.find(r => r.day === day);
    days.push({ day, revenue: found ? found.revenue : 0 });
  }
  res.json(days);
});

app.get('/api/admin/stats/most-sold', adminAuth, async (req, res) => {
  const mostSold = await query("SELECT product_name, COUNT(*) as times_sold, SUM(quantity) as total_qty FROM orders WHERE payment_status = 'verified' GROUP BY product_name ORDER BY total_qty DESC LIMIT 5");
  res.json(mostSold);
});

app.get('/api/admin/orders', adminAuth, async (req, res) => {
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  let pIdx = 1;
  if (req.query.status) { sql += ` AND status = $${pIdx++}`; params.push(req.query.status); }
  if (req.query.payment_status) { sql += ` AND payment_status = $${pIdx++}`; params.push(req.query.payment_status); }
  if (req.query.phone) { sql += ` AND phone = $${pIdx++}`; params.push(req.query.phone); }
  if (req.query.search) { sql += ` AND (customer_name ILIKE $${pIdx} OR phone ILIKE $${pIdx+1})`; const s = '%' + req.query.search + '%'; params.push(s, s); pIdx += 2; }
  if (req.query.category) { sql += ` AND (LOWER(product_category) = LOWER($${pIdx++}) OR product_category = 'mixed')`; params.push(req.query.category); }
  sql += ' ORDER BY created_at DESC';
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const total = (await queryOne(`SELECT COUNT(*) as count FROM (${sql}) sub`, params))?.count || 0;
  const rows = await query(sql + ` LIMIT $${pIdx++} OFFSET $${pIdx}`, [...params, limit, offset]);
  res.json({ orders: rows, total, page, pages: Math.ceil(total / limit) });
});

app.get('/api/admin/verify', adminAuth, async (req, res) => {
  const pending = await query("SELECT * FROM orders WHERE payment_status = 'paid' AND payment_screenshot != '' ORDER BY created_at DESC");
  const verified = await query("SELECT * FROM orders WHERE payment_status = 'verified' ORDER BY created_at DESC");
  res.json({ pending, verified });
});

app.put('/api/admin/orders/:id', adminAuth, async (req, res) => {
  const { status, payment_status } = req.body;
  const order = await queryOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const updates = [];
  const params = [];
  let pIdx = 1;
  if (status) { updates.push(`status = $${pIdx++}`); params.push(status); }
  if (payment_status) { updates.push(`payment_status = $${pIdx++}`); params.push(payment_status); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  await execute(`UPDATE orders SET ${updates.join(', ')} WHERE id = $${pIdx}`, params);
  res.json({ success: true });
});

app.put('/api/admin/orders/:id/verify', adminAuth, async (req, res) => {
  const { payment_status, unverify } = req.body;
  const order = await queryOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (unverify) {
    if (order.payment_status !== 'verified') return res.status(400).json({ error: 'Order is not verified' });
    if (order.payment_screenshot) {
      try { const m = order.payment_screenshot.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/); if (m) await cloudinary.deleteImage(m[1]); } catch {}
    }
    await execute('DELETE FROM orders WHERE id = $1', [req.params.id]);
    return res.json({ success: true, message: 'Order deleted' });
  }
  if (payment_status === 'verified') {
    if (order.payment_status === 'verified') return res.status(400).json({ error: 'Order already verified' });
    await execute("UPDATE orders SET payment_status = 'verified', tracking_status = 'verified', status = 'confirmed' WHERE id = $1", [req.params.id]);
    await ensureCustomer(order.phone);
    await execute('UPDATE customers SET loyalty_points = loyalty_points + 1 WHERE phone = $1', [order.phone]);
    if (order.payment_screenshot) {
      try { const m = order.payment_screenshot.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/); if (m) await cloudinary.deleteImage(m[1]); } catch {}
    }
  } else {
    await execute('UPDATE orders SET payment_status = $1 WHERE id = $2', [payment_status, req.params.id]);
  }
  res.json({ success: true });
});

app.post('/api/admin/orders/bulk-verify', adminAuth, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });
  let verifiedCount = 0;
  for (const id of ids) {
    const order = await queryOne('SELECT * FROM orders WHERE id = $1', [id]);
    if (order && order.payment_status !== 'verified') {
      await execute("UPDATE orders SET payment_status = 'verified', tracking_status = 'verified', status = 'confirmed' WHERE id = $1", [id]);
      await ensureCustomer(order.phone);
      await execute('UPDATE customers SET loyalty_points = loyalty_points + 1 WHERE phone = $1', [order.phone]);
      verifiedCount++;
    }
  }
  res.json({ success: true, verified: verifiedCount });
});

app.get('/api/admin/loyalty', adminAuth, async (req, res) => {
  const { phone } = req.query;
  if (!phone) {
    const allCustomers = await query('SELECT phone, name, loyalty_points, discount_used FROM customers ORDER BY loyalty_points DESC');
    return res.json(allCustomers);
  }
  const customer = await queryOne('SELECT * FROM customers WHERE phone = $1', [phone]);
  if (!customer) return res.status(404).json({ error: 'No customer found with this phone' });
  const info = await getLoyaltyInfo(phone);
  res.json({ ...customer, ...info });
});

app.put('/api/admin/orders/:id/tracking', adminAuth, async (req, res) => {
  const { tracking_status, tracking_id } = req.body;
  const order = await queryOne('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (tracking_status === 'dispatched' && !tracking_id) return res.status(400).json({ error: 'Tracking ID is required for dispatched status' });
  await execute('UPDATE orders SET tracking_status = $1, tracking_id = $2 WHERE id = $3', [tracking_status, tracking_id || null, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/admin/orders/:id', adminAuth, async (req, res) => {
  await execute('DELETE FROM orders WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

app.post('/api/admin/orders/batch-delete', adminAuth, async (req, res) => {
  const ids = req.body.ids;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'No IDs provided' });
  await execute('DELETE FROM orders WHERE id = ANY($1::int[])', [ids]);
  res.json({ success: true, deleted: ids.length });
});

app.get('/api/admin/products', adminAuth, async (req, res) => {
  res.json(await query('SELECT * FROM products ORDER BY created_at DESC'));
});

app.get('/api/admin/products/:id', adminAuth, async (req, res) => {
  const product = await queryOne('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

app.post('/api/admin/products', adminAuth, upload.single('image'), async (req, res) => {
  const { name, description, price, offer_price, offer_note, category, stock, scheduled_at } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Product name is required' });
  const parsedPrice = parseFloat(price);
  if (isNaN(parsedPrice) || parsedPrice < 0) return res.status(400).json({ error: 'Valid non-negative price is required' });
  const parsedStock = parseInt(stock);
  if (isNaN(parsedStock) || parsedStock < 0) return res.status(400).json({ error: 'Valid non-negative stock is required' });
  let image = null;
  if (req.file) {
    const result = await cloudinary.uploadBuffer(req.file.buffer, 'mellowluv');
    image = result.url;
  }
  const result = await execute(
    'INSERT INTO products (name, description, price, offer_price, offer_note, category, stock, image, scheduled_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [name.trim(), description || '', parsedPrice, offer_price || null, offer_note || '', category, parsedStock, image, scheduled_at || null]
  );
  res.json({ success: true, product: await queryOne('SELECT * FROM products WHERE id = $1', [result.lastInsertRowid]) });
});

app.put('/api/admin/products/:id', adminAuth, upload.single('image'), async (req, res) => {
  const { name, description, price, offer_price, offer_note, category, stock, scheduled_at } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Product name is required' });
  const parsedPrice = parseFloat(price);
  if (isNaN(parsedPrice) || parsedPrice < 0) return res.status(400).json({ error: 'Valid non-negative price is required' });
  const parsedStock = parseInt(stock);
  if (isNaN(parsedStock) || parsedStock < 0) return res.status(400).json({ error: 'Valid non-negative stock is required' });
  const product = await queryOne('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  let image = product.image;
  if (req.file) {
    const result = await cloudinary.uploadBuffer(req.file.buffer, 'mellowluv');
    image = result.url;
  }
  await execute(
    'UPDATE products SET name=$1, description=$2, price=$3, offer_price=$4, offer_note=$5, category=$6, stock=$7, image=$8, scheduled_at=$9 WHERE id=$10',
    [name.trim(), description || '', parsedPrice, offer_price || null, offer_note || '', category, parsedStock, image, scheduled_at || null, req.params.id]
  );
  res.json({ success: true, product: await queryOne('SELECT * FROM products WHERE id = $1', [req.params.id]) });
});

app.delete('/api/admin/products/:id', adminAuth, async (req, res) => {
  const product = await queryOne('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (product && product.image) {
    try { const m = product.image.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/); if (m) await cloudinary.deleteImage(m[1]); } catch {}
  }
  await execute('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/admin/settings', adminAuth, async (req, res) => {
  const rows = await query('SELECT * FROM settings');
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

app.put('/api/admin/settings', adminAuth, async (req, res) => {
  const allowed = ['upi_id', 'upi_name', 'shipping_charge', 'admin_username', 'admin_password', 'contact_phone', 'contact_instagram', 'ntfy_topic'];
  for (const [key, value] of Object.entries(req.body)) {
    if (allowed.includes(key)) {
      if (value === '' || value === null || value === undefined) {
        await execute('DELETE FROM settings WHERE key = $1', [key]);
      } else {
        await execute('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2', [key, value]);
      }
    }
  }
  res.json({ success: true });
});

// --- Products ---
app.get('/api/products', async (req, res) => {
  const { category, sort } = req.query;
  let sql = 'SELECT * FROM products';
  const params = [];
  const conditions = [];
  conditions.push('stock > 0');
  let pIdx = 1;
  if (category) { conditions.push(`category = $${pIdx++}`); params.push(category); }
  sql += ' WHERE ' + conditions.join(' AND ');
  if (sort === 'price_asc') sql += ' ORDER BY price ASC';
  else if (sort === 'price_desc') sql += ' ORDER BY price DESC';
  else if (sort === 'newest') sql += ' ORDER BY created_at DESC';
  else sql += ' ORDER BY created_at DESC';
  const products = await query(sql, params);
  res.json(products.map(p => ({ ...p, is_live: !(p.scheduled_at && new Date(p.scheduled_at) > new Date()) })));
});

app.get('/api/products/upcoming', async (req, res) => {
  res.json(await query("SELECT * FROM products WHERE scheduled_at IS NOT NULL AND scheduled_at > NOW() AND stock > 0 ORDER BY scheduled_at ASC LIMIT 10"));
});

app.get('/api/products/:id', async (req, res) => {
  const product = await queryOne('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const isScheduled = product.scheduled_at && new Date(product.scheduled_at) > new Date();
  res.json({ ...product, is_live: !isScheduled });
});

// --- Start ---
async function start() {
  app.listen(PORT, () => {
    console.log(`Mellowluv running at http://localhost:${PORT}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
