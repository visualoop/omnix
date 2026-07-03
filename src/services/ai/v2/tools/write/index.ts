/**
 * Write-tier tools index — importing this file registers every write
 * tool into the singleton registry.
 *
 * All tools here require user approval (tier="write") unless explicitly
 * bumped to "destructive". Delete/void operations should live in a
 * separate destructive-tier module which we're intentionally NOT
 * shipping yet — the AI should be able to create + edit + record almost
 * anything but never delete data.
 *
 * Tools shipped so far:
 *   Inventory      : create_product
 *   Parties        : create_customer, create_supplier
 *   Finance        : record_expense, record_petty_cash, create_purchase_order
 *   Hospitality    : create_dining_area, create_table, create_kitchen_station,
 *                    create_menu_item, create_room_type, create_room,
 *                    create_booking, open_order, add_order_item
 *   Pharmacy       : create_prescription, refill_prescription
 *   Retail         : create_brand, create_layby, create_special_order,
 *                    record_shrinkage (destructive)
 *   Hardware       : create_hardware_quotation, create_delivery_note
 */
export * as CreateProduct from "./create-product";
export * as CreateParties from "./create-parties";
export * as FinanceOps from "./finance-ops";
export * as Hospitality from "./hospitality";
export * as Pharmacy from "./pharmacy";
export * as RetailHardware from "./retail-hardware";
