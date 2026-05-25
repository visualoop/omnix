use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Product {
    pub id: String,
    pub name: String,
    pub sku: Option<String>,
    pub barcode: Option<String>,
    pub category_id: Option<String>,
    pub unit: String,
    pub description: Option<String>,
    pub reorder_level: i32,
    pub tax_rate: f64,
    pub active: bool,
    pub buying_price: f64,
    pub selling_price: f64,
    pub stock_qty: f64,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateProductInput {
    pub name: String,
    pub sku: Option<String>,
    pub barcode: Option<String>,
    pub category_id: Option<String>,
    pub unit: Option<String>,
    pub description: Option<String>,
    pub reorder_level: Option<i32>,
    pub tax_rate: Option<f64>,
    pub buying_price: f64,
    pub selling_price: f64,
    pub initial_stock: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub sort_order: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateCategoryInput {
    pub name: String,
    pub parent_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct StockAdjustment {
    pub product_id: String,
    pub quantity: f64,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockMovement {
    pub id: String,
    pub product_id: String,
    pub product_name: String,
    pub batch_id: Option<String>,
    pub r#type: String,
    pub quantity: f64,
    pub notes: Option<String>,
    pub created_at: String,
}
