-- ============================================================================
-- 037_hospitality_recipes.sql — Recipes, costing & wastage (plan 08 Batch 7)
-- v1 provides recipe costing + wastage logging; auto ingredient deduction on
-- sale is deferred to keep stock accurate under voids.
-- ============================================================================

CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    menu_item_id TEXT NOT NULL REFERENCES menu_items(id),
    yield_quantity REAL NOT NULL DEFAULT 1,
    instructions TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    wastage_percent REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS hospitality_wastage (
    id TEXT PRIMARY KEY,
    branch_id TEXT,
    product_id TEXT NOT NULL REFERENCES products(id),
    quantity REAL NOT NULL,
    reason TEXT NOT NULL
      CHECK (reason IN ('prep_waste','spoilage','burnt','breakage','staff_meal','comped')),
    cost_value REAL,
    user_id TEXT REFERENCES users(id),
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_hosp_wastage_recorded ON hospitality_wastage(recorded_at);
