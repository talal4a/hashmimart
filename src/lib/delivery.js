/* ── Delivery charges ──
   Single source of truth for the delivery rule used across cart, checkout,
   and the stored order total: Rs 50 flat, waived on orders of Rs 500 or more.
   Change the numbers here and every screen stays consistent. */

export const DELIVERY_CHARGE = 50;
export const FREE_DELIVERY_THRESHOLD = 500;

/* Charge Rs 50 unless the subtotal reaches the free-delivery threshold. */
export function getDeliveryCharge(subtotal) {
  return subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_CHARGE;
}

export function isFreeDelivery(subtotal) {
  return getDeliveryCharge(subtotal) === 0;
}

/* How much more the customer must spend to unlock free delivery (0 when
   already unlocked). */
export function getFreeDeliveryRemaining(subtotal) {
  return Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
}

/* 0-100 fill for the progress bar toward free delivery. */
export function getFreeDeliveryProgress(subtotal) {
  return Math.min(100, Math.round((subtotal / FREE_DELIVERY_THRESHOLD) * 100));
}
