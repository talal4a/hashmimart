import { formatPrice } from "../data/products";

/* Subtotal / discount / delivery rows for a cart order, as it was charged.
   Orders placed before the price breakdown was stored have no subtotal, so
   they render nothing and the caller's total row stands alone. */
export default function OrderPriceBreakdown({ order }) {
  if (order.subtotal == null) return null;

  return (
    <dl className="order-breakdown">
      <div className="order-breakdown-row">
        <dt>Subtotal</dt>
        <dd>{formatPrice(order.subtotal)}</dd>
      </div>
      {order.discountAmount > 0 && (
        <div className="order-breakdown-row order-breakdown-row--discount">
          <dt>Discount</dt>
          <dd>−{formatPrice(order.discountAmount)}</dd>
        </div>
      )}
      {order.deliveryCharge != null && (
        <div className="order-breakdown-row">
          <dt>Delivery</dt>
          <dd>
            {order.deliveryCharge > 0
              ? formatPrice(order.deliveryCharge)
              : "FREE"}
          </dd>
        </div>
      )}
    </dl>
  );
}
