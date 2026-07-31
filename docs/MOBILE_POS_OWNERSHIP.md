# Responsive Android POS ownership

Tracker task 16 is owned by the POS surface in `src/pages/pos-sale.tsx`, `src/components/pos/`, POS-specific hooks, and the cart store persistence seam. The adaptive implementation reuses the existing cart, product gates, pickers, held-sale and return workflows, and authoritative payment modal.

## Composition contract

| Form factor | Composition |
| --- | --- |
| Phone (`<768px`) | Scanner/search header, horizontal category navigation, bounded two-column product feed, sticky cart summary, full-height cart, staged checkout, and full-height payment/receipt surfaces. |
| Tablet (`768–1023px`) | Scanner/search header with a two-pane product browser and always-visible cart. Entry, checkout, and receipt surfaces remain touch-first. |
| Desktop (`>=1024px`) | Existing three-pane category/product/cart workspace, toolbar, shortcuts, status and density are preserved. |

`POSSalePage` accepts an optional `formFactor` override. The responsive foundation can pass `phone | tablet | desktop`; until integration, the POS-owned viewport adapter updates on resize and rotation.

## Product and cart paths

- Physical scanners continue through `useScanner`; exact barcodes and pack/carton barcodes use the existing search/add path. The scan affordance returns focus to the search field for Android scanner input.
- Category navigation is horizontally scrollable on phone and tablet. Product results are capped at 100 visible entries and direct the cashier to refine search rather than rendering an unbounded feed.
- Every add delegates to the existing product path in `POSSalePage`: variant products open `VariantPickerDialog`, serial-tracked equipment opens `UnitPickerDialog`, and Dawa products pass `checkPharmacyAdd` before entering the cart.
- Phone uses a sticky summary and a full-height cart. Tablet embeds that same cart model as its second pane. Cart quantity editing is stock-capped; discount and tip editors are form-factor-aware full-height sheets on Android.
- Customer selection is searchable by name, phone, or email, includes Walk-in, supports quick creation, and returns focus to its trigger.
- Hold/recall and return entry reuse the existing services. Shift status opens either the open-shift or close-shift flow according to current state.

## Sale authority

`PaymentModal` remains the sole normal POS sale authority. Adaptive checkout only stages **Review → Customer → Payment**, then delegates. It does not construct tender rows and must never import or call `completeSale`.

Cash, M-Pesa, card, split payment, customer credit, insurance/copay, source finalization, stock commitment, eTIMS, receipt building, and cart clearing remain in `PaymentModal` and the existing branch-hub/service path. The static authority test fails if an adaptive component starts calling `completeSale`.

On phone/tablet, the authoritative modal becomes a full-height payment surface. After its existing completion path succeeds, it shows the receipt result with Print, Android Web Share, clipboard fallback for offline sharing, and Start new sale. Desktop retains automatic printing and the prior close behavior.

## Recovery, branch and device behavior

The Zustand cart persists the sale-critical subset under `omnix-cart`: items (including variants and serial units), customer, cart discount/promotion, tip/staff assignment, service charge, tax mode, source metadata, quote mode, and revision. Rotation does not remount the POS route; Android background/process recovery rehydrates the staged sale from local storage.

Shift state is re-read from SQLite on POS mount and after open/close. The mobile status control always names the active branch and shows branch-hub/client/standalone state plus browser offline state. Sync failure never disables local browsing or cart work; checkout still goes through the existing authoritative path.

Adaptive overlays use `100dvh`, safe-area insets, contained scroll regions, decimal/numeric/search keyboard hints, visible focus rings, explicit focus return where overlays are manually staged, reduced-motion overrides, and minimum 44px touch actions. No Android-specific dependency or router/layout change is required.

## Integration seam

No `App.tsx`, layout, package, lockfile, Tauri config, or workflow change belongs to this task. If the responsive foundation later owns form-factor detection, pass its value to `<POSSalePage formFactor={...} />` and remove only the fallback detection inside `use-pos-form-factor.ts`. Do not change adaptive composition or sale authority.
