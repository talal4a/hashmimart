import { Link } from "react-router-dom";
import { formatPrice } from "../data/products";
import { useStore } from "../context/StoreContext";
import QuantityControl from "../components/QuantityControl";
import { IconTrash } from "../components/Icons";

export default function CartPage() {
  const { cart, cartTotal, updateCartQuantity, removeFromCart } = useStore();

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
            <div className="cart-item-info">
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
                {item.category === "wholesale" && (
                  <span className="tag tag-wholesale">Wholesale</span>
                )}
              </p>
              <div className="cart-item-actions">
                <QuantityControl
                  value={item.quantity}
                  onChange={(qty) => updateCartQuantity(item.productId, qty)}
                  size="sm"
                />
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  onClick={() => removeFromCart(item.productId)}
                  aria-label={`Remove ${item.name}`}
                >
                  <IconTrash />
                </button>
              </div>
            </div>
            <p className="cart-item-total">
              {formatPrice(
                (item.salePrice && item.salePrice > 0
                  ? item.salePrice
                  : item.price) * item.quantity,
              )}
            </p>
          </li>
        ))}
      </ul>

      <div className="cart-summary">
        <div className="cart-summary-row">
          <span>Subtotal</span>
          <strong>{formatPrice(cartTotal)}</strong>
        </div>
        <div className="cart-summary-row cart-summary-row-muted">
          <span>Delivery</span>
          <span>Lahore only</span>
        </div>
        <div className="cart-summary-row cart-summary-row-total">
          <span>Total</span>
          <strong>{formatPrice(cartTotal)}</strong>
        </div>
        <Link to="/checkout" className="btn btn-primary btn-block">
          Proceed to Checkout
        </Link>
      </div>
    </div>
  );
}
