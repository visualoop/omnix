-- 079_units.sql — units of measure with dimension + conversion factor.
--
-- Motivation: products.unit was a free-text column. That let the operator
-- type "gram", "grams", "g", "gm" — all the same unit, none comparable.
-- Recipes couldn't convert between units either (200g of flour is 0.2kg
-- but the app had no way to know). Now:
--
--   1. Every unit has a dimension (mass / volume / count / length).
--   2. Every unit has a base_unit_id + factor_to_base so any two units
--      of the SAME dimension can be converted in JS with one multiply.
--   3. Standalone count units (bag, sack, bunch, tin) sit in the count
--      dimension with themselves as base + factor 1 (no cross-conversion
--      because "1 bag of cement" cannot be expressed as "N pieces of X").
--   4. Seed data is Kenya-oriented — the crate is 24 (soda default here,
--      not the 12/16/20 you see elsewhere), the bale/sack/bunch/tin are
--      what suppliers actually price against in the market.
--
-- Operators can add their own units through Settings → Units without
-- editing this migration.

CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,                                   -- 'g', 'kg', 'crate'
  label TEXT NOT NULL,                                    -- 'gram'
  plural TEXT,                                            -- 'grams'
  dimension TEXT NOT NULL CHECK (dimension IN ('mass','volume','count','length')),
  base_unit_id TEXT NOT NULL REFERENCES units(id),
  factor_to_base REAL NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_units_dimension ON units(dimension);
CREATE INDEX IF NOT EXISTS idx_units_active ON units(active);

-- Base units first (self-referential), then dependents.
INSERT OR IGNORE INTO units (id, label, plural, dimension, base_unit_id, factor_to_base, sort_order) VALUES
  -- Mass (base = kg)
  ('kg',     'kilogram',   'kilograms',   'mass',   'kg',     1,        20),
  ('g',      'gram',       'grams',       'mass',   'kg',     0.001,    10),
  ('mg',     'milligram',  'milligrams',  'mass',   'kg',     0.000001, 5),
  ('t',      'tonne',      'tonnes',      'mass',   'kg',     1000,     30),

  -- Volume (base = l)
  ('l',      'litre',      'litres',      'volume', 'l',      1,        20),
  ('ml',     'millilitre', 'millilitres', 'volume', 'l',      0.001,    10),

  -- Length (base = m)
  ('m',      'metre',      'metres',      'length', 'm',      1,        20),
  ('cm',     'centimetre', 'centimetres', 'length', 'm',      0.01,     10),
  ('mm',     'millimetre', 'millimetres', 'length', 'm',      0.001,    5),
  ('ft',     'foot',       'feet',        'length', 'm',      0.3048,   30),
  ('inch',   'inch',       'inches',      'length', 'm',      0.0254,   15),

  -- Count / packaging (base = self; Kenya-oriented defaults)
  ('pcs',    'piece',      'pieces',      'count',  'pcs',    1,        10),
  ('dozen',  'dozen',      'dozens',      'count',  'pcs',    12,       20),
  ('crate',  'crate',      'crates',      'count',  'crate',  1,        30),  -- soda crate — 24 in Kenya but treated as its own unit for reordering
  ('carton', 'carton',     'cartons',     'count',  'carton', 1,        40),
  ('bag',    'bag',        'bags',        'count',  'bag',    1,        50),  -- 50 kg cement / unga bag
  ('sack',   'sack',       'sacks',       'count',  'sack',   1,        60),  -- rice / maize sack
  ('bale',   'bale',       'bales',       'count',  'bale',   1,        70),
  ('bunch',  'bunch',      'bunches',     'count',  'bunch',  1,        80),  -- sukuma / bananas / kale
  ('roll',   'roll',       'rolls',       'count',  'roll',   1,        90),
  ('pkt',    'packet',     'packets',     'count',  'pkt',    1,        100),
  ('tin',    'tin',        'tins',        'count',  'tin',    1,        110),
  ('bottle', 'bottle',     'bottles',     'count',  'bottle', 1,        120),
  ('can',    'can',        'cans',        'count',  'can',    1,        130),
  ('pkg',    'package',    'packages',    'count',  'pkg',    1,        140),
  ('serving','serving',    'servings',    'count',  'serving',1,        150);  -- hospitality plate
