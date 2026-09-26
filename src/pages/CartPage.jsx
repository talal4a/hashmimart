import { useEffect } from "react";
import { Link } from "react-router-dom";
import { formatPrice } from "../data/products";
import {
  computeOrderTotals,
  describeDiscount,
  getDiscountRemaining,
  getFreeDeliveryRemaining,
  hasFreeDeliveryOffer,
  hasOrderDiscount,
  isFreeDelivery,
} from "../lib/pricing";
import { useStore } from "../context/StoreContext";
import QuantityControl from "../components/QuantityControl";
import { IconTrash } from "../components/Icons";

export default function CartPage() {
  const {
    cart,
    cartTotal,
    updateCartQuantity,
    removeFromCart,
    storeSettings,
    refreshStoreSettings,
  } = useStore();

  // Pick up any fee/discount change the admin made since the app loaded.
  useEffect(() => {
    refreshStoreSettings();
  }, [refreshStoreSettings]);

  const { discount, deliveryCharge, total: orderTotal } = computeOrderTotals(
    cartTotal,
    storeSettings,
  );
  const freeDeliveryUnlocked = isFreeDelivery(cartTotal, storeSettings);
  const freeDeliveryRemaining = getFreeDeliveryRemaining(
    cartTotal,
    storeSettings,
  );
  const discountRemaining = getDiscountRemaining(cartTotal, storeSettings);

  if (cart.length === 0) {
    return (
      <div className="empty-page">
        <p className="empty-state">Your cart is empty</p>
        <Link to="/" className="btn btn-secondary">
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <ul className="cart-list">
        {cart.map((item) => (
          <li key={item.productId} className="cart-item">
            <div className="cart-item-left">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="cart-item-image"
                  loading="lazy"
                />
              ) : (
                <div className="cart-item-emoji" aria-hidden="true">
                  {item.image}
                </div>
              )}
              <div className="cart-item-details">
                <h3>{item.name}</h3>
                <p className="cart-item-meta">
                  {item.salePrice && item.salePrice > 0 ? (
                    <>
                      <span className="cart-item-sale-price">
                        {formatPrice(item.salePrice)}
                      </span>
                      <span className="cart-item-original-price">
                        {formatPrice(item.price)}
                      </span>
                    </>
                  ) : (
                    formatPrice(item.price)
                  )}{" "}
                  / {item.unit}
                </p>
              </div>
            </div>
            <div className="cart-item-right">
              <div className="cart-item-actions">
                <QuantityControl
                  value={item.quantity}
                  onChange={(qty) => updateCartQuantity(item.productId, qty)}
                  size="sm"
                />
              </div>
              <div className="cart-item-delete">
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  onClick={() => removeFromCart(item.productId)}
                  aria-label={`Remove ${item.name}`}
                >
                  <IconTrash />
                </button>
              </div>
              <p className="cart-item-total">
                {formatPrice(
                  (item.salePrice && item.salePrice > 0
                    ? item.salePrice
                    : item.price) * item.quantity,
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="cart-summary">
        <div className="cart-summary-row">
          <span>Subtotal</span>
          <strong>{formatPrice(cartTotal)}</strong>
        </div>
        {discount > 0 && (
          <div className="cart-summary-row cart-summary-row-discount">
            <span>Discount ({describeDiscount(storeSettings)})</span>
            <strong>−{formatPrice(discount)}</strong>
          </div>
        )}
        <div className="cart-summary-row cart-summary-row-muted">
          <span>Delivery</span>
          {freeDeliveryUnlocked ? (
            <span className="cart-summary-free">
              {storeSettings.deliveryFee > 0 && (
                <>
                  <s>{formatPrice(storeSettings.deliveryFee)}</s>{" "}
                </>
              )}
              <span className="checkout-gold-text">FREE</span>
            </span>
          ) : (
            <span>{formatPrice(deliveryCharge)}</span>
          )}
        </div>
        {hasOrderDiscount(storeSettings) && discountRemaining > 0 && (
          <p className="cart-summary-free-nudge cart-summary-discount-nudge">
            🏷️ Add {formatPrice(discountRemaining)} more to get{" "}
            {describeDiscount(storeSettings)} your order!
          </p>
        )}
        {hasFreeDeliveryOffer(storeSettings) && !freeDeliveryUnlocked && (
          <p className="cart-summary-free-nudge checkout-gold-text">
            🚚 Add {formatPrice(freeDeliveryRemaining)} more to get FREE
            delivery on orders of{" "}
            {formatPrice(storeSettings.freeDeliveryThreshold)} or more!
          </p>
        )}
        <div className="cart-summary-row cart-summary-row-total">
          <span>Total</span>
          <strong>{formatPrice(orderTotal)}</strong>
        </div>
        <Link to="/checkout" className="btn btn-primary btn-block">
          Proceed to Checkout
        </Link>
      </div>
    </div>
  );
}
