-- 078_recipe_canvas.sql — persist visual recipe builder layout.
--
-- Stores React Flow's `{ nodes: [{ id, x, y }], viewport: { x, y, zoom } }`
-- as JSON so laid-out graphs survive reloads. On first open with a NULL
-- value, the canvas auto-runs dagre L→R layout, then saves the result.
ALTER TABLE recipes ADD COLUMN canvas_layout TEXT;
