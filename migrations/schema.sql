-- Run this SQL in your Supabase SQL Editor to create all tables

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('thrift', 'jewelry')),
  stock INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  offer_price REAL,
  offer_note TEXT,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Run this separately on existing databases:
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_screenshot TEXT DEFAULT '';

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_name TEXT NOT NULL,
  address TEXT NOT NULL,
  pincode TEXT NOT NULL,
  urgency TEXT DEFAULT '',
  aesthetics TEXT DEFAULT '',
  extra_note TEXT DEFAULT '',
  phone TEXT,
  instagram TEXT DEFAULT '',
  quantity INTEGER DEFAULT 1,
  product_id INTEGER,
  product_name TEXT,
  product_price REAL,
  product_category TEXT,
  shipping_charge REAL DEFAULT 0,
  total REAL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  payment_status TEXT DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid', 'verified')),
  tracking_status TEXT DEFAULT 'unverified',
  tracking_id TEXT,
  extra_charge INTEGER DEFAULT 0,
  discount_applied INTEGER DEFAULT 0,
  is_prebook INTEGER DEFAULT 0,
  loyalty_award INTEGER DEFAULT 1,
  payment_screenshot TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  phone TEXT PRIMARY KEY,
  name TEXT DEFAULT '',
  password TEXT,
  token TEXT,
  loyalty_points INTEGER DEFAULT 0,
  discount_used INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Insert default settings
INSERT INTO settings (key, value) VALUES ('upi_id', '8401535686@fam') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('upi_name', 'Mellowluv') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('shipping_charge', '50') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('contact_phone', '8401535686') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('contact_instagram', '@mellowluvv_') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('ntfy_topic', '') ON CONFLICT (key) DO NOTHING;
