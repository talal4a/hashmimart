/* ── Order pricing ──
   Single source of truth for delivery charges and the store-wide order
   discount used by cart, checkout, the stored order total and the admin view.
   The numbers come from the admin-managed `store_settings` row (see
   supabase/store-settings-text-orders-subcategories.sql); DEFAULT_STORE_SETTINGS
   is the fallback until that row loads, and matches the old hardcoded rule:
   Rs 50 delivery, free from Rs 500, no discount. */

export const DEFAULT_STORE_SETTINGS = Object.freeze({
  deliveryFee: 50,
  freeDeliveryEnabled: true,
  freeDeliveryThreshold: 500,
  discountEnabled: false,
  discountType: "percentage", // "percentage" | "fixed"
  discountValue: 0,
  discountMinOrder: 0,
});

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/* Map a store_settings row (snake_case) to the app's settings shape. Any
   missing or bad field falls back to its default. */
export function settingsFromRow(row) {
  const d = DEFAULT_STORE_SETTINGS;
  if (!row) return { ...d };
  return {
    deliveryFee: num(row.delivery_fee, d.deliveryFee),
    freeDeliveryEnabled:
      row.free_delivery_enabled == null
        ? d.freeDeliveryEnabled
        : Boolean(row.free_delivery_enabled),
    freeDeliveryThreshold: num(
      row.free_delivery_threshold,
      d.freeDeliveryThreshold,
    ),
    discountEnabled: Boolean(row.discount_enabled),
    discountType: row.discount_type === "fixed" ? "fixed" : "percentage",
    discountValue: num(row.discount_value, d.discountValue),
    discountMinOrder: num(row.discount_min_order, d.discountMinOrder),
  };
}

export function settingsToRow(s) {
  return {
    delivery_fee: s.deliveryFee,
    free_delivery_enabled: s.freeDeliveryEnabled,
    free_delivery_threshold: s.freeDeliveryThreshold,
    discount_enabled: s.discountEnabled,
    discount_type: s.discountType,
    discount_value: s.discountValue,
    discount_min_order: s.discountMinOrder,
  };
}

/* True when the customer pays no delivery for this subtotal — either the
   fee is zero, or free delivery is on and the subtotal reached the threshold. */
export function isFreeDelivery(subtotal, s = DEFAULT_STORE_SETTINGS) {
  if (s.deliveryFee <= 0) return true;
  return s.freeDeliveryEnabled && subtotal >= s.freeDeliveryThreshold;
}

export function getDeliveryCharge(subtotal, s = DEFAULT_STORE_SETTINGS) {
  return isFreeDelivery(subtotal, s) ? 0 : s.deliveryFee;
}

/* Whether the "spend Rs X more for free delivery" nudge applies at all. */
export function hasFreeDeliveryOffer(s = DEFAULT_STORE_SETTINGS) {
  return s.deliveryFee > 0 && s.freeDeliveryEnabled;
}

/* How much more the customer must spend to unlock free delivery (0 when
   already unlocked or when there is no free-delivery offer). */
export function getFreeDeliveryRemaining(subtotal, s = DEFAULT_STORE_SETTINGS) {
  if (!hasFreeDeliveryOffer(s)) return 0;
  return Math.max(0, s.freeDeliveryThreshold - subtotal);
}

/* 0-100 fill for the progress bar toward free delivery. */
export function getFreeDeliveryProgress(subtotal, s = DEFAULT_STORE_SETTINGS) {
  if (!hasFreeDeliveryOffer(s) || s.freeDeliveryThreshold <= 0) return 100;
  return Math.min(100, Math.round((subtotal / s.freeDeliveryThreshold) * 100));
}

/* The store-wide discount is live and has a value worth showing. */
export function hasOrderDiscount(s = DEFAULT_STORE_SETTINGS) {
  return s.discountEnabled && s.discountValue > 0;
}

/* Rupee amount taken off this subtotal by the store-wide discount. Never more
   than the subtotal itself; 0 below the minimum order. */
export function getOrderDiscount(subtotal, s = DEFAULT_STORE_SETTINGS) {
  if (!hasOrderDiscount(s) || subtotal <= 0) return 0;
  if (subtotal < s.discountMinOrder) return 0;
  const raw =
    s.discountType === "fixed"
      ? s.discountValue
      : (subtotal * Math.min(s.discountValue, 100)) / 100;
  return Math.min(subtotal, Math.round(raw));
}

/* How much more to spend before the discount kicks in (0 once it applies). */
export function getDiscountRemaining(subtotal, s = DEFAULT_STORE_SETTINGS) {
  if (!hasOrderDiscount(s)) return 0;
  return Math.max(0, s.discountMinOrder - subtotal);
}

/* Short customer-facing label, e.g. "10% off" or "Rs. 100 off" (same
   rupee format as formatPrice). */
export function describeDiscount(s = DEFAULT_STORE_SETTINGS) {
  if (s.discountType === "fixed") {
    return `Rs. ${s.discountValue.toLocaleString("en-PK")} off`;
  }
  return `${s.discountValue}% off`;
}

/* Full breakdown for a cart subtotal. Delivery is judged on the items
   subtotal (before the store discount), so a discount never costs the
   customer their free delivery. */
export function computeOrderTotals(subtotal, s = DEFAULT_STORE_SETTINGS) {
  const discount = getOrderDiscount(subtotal, s);
  const deliveryCharge = getDeliveryCharge(subtotal, s);
  return {
    subtotal,
    discount,
    deliveryCharge,
    total: Math.max(0, subtotal - discount) + deliveryCharge,
  };
}
