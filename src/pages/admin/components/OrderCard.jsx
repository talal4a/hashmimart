import { formatPrice } from "../../../data/products";

export default function OrderCard({ order, onUpdateStatus }) {
  const isPending = order.status === "pending";
  const isTerminal =
    order.status === "delivered" || order.status === "cancelled";

  return (
    <article className={`admin-order-card admin-order-card--${order.status}`}>
      <header className="admin-order-card__header">
        <div className="admin-order-card__id">
          <span className="admin-order-card__number">#{order.id}</span>
          <time className="admin-order-card__date">
            {new Date(order.createdAt).toLocaleString("en-PK", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
        <span
          className={`admin-order-card__status admin-order-card__status--${order.status}`}
        >
          {order.status}
        </span>
      </header>

      <div className="admin-order-card__customer">
        <div className="admin-order-card__customer-header">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <h4>Customer Details</h4>
        </div>
        <div className="admin-order-card__customer-info">
          <div className="admin-order-card__info-row">
            <span className="admin-order-card__label">Name</span>
            <strong>{order.customer?.fullName || "Unknown User"}</strong>
          </div>
          <div className="admin-order-card__info-row">
            <span className="admin-order-card__label">Phone</span>
            <span>{order.customer?.phone || "No phone number"}</span>
          </div>
          {order.customer?.email && (
            <div className="admin-order-card__info-row">
              <span className="admin-order-card__label">Email</span>
              <span>{order.customer.email}</span>
            </div>
          )}
          <div className="admin-order-card__info-row">
            <span className="admin-order-card__label">Payment</span>
            <span className="admin-order-card__payment">
              {order.paymentMethod}
            </span>
          </div>
          <div className="admin-order-card__info-row">
            <span className="admin-order-card__label">Address</span>
            <span className="admin-order-card__address">
              {order.customer?.address || "No address provided"}
            </span>
          </div>
        </div>
      </div>

      <div className="admin-order-card__items">
        <div className="admin-order-card__items-header">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <h4>Order Items</h4>
        </div>
        <div className="admin-order-card__items-list">
          {(order.items || []).map((item) => (
            <div key={item.productId} className="admin-order-card__item">
              <div className="admin-order-card__item-main">
                <span
                  className="admin-order-card__item-emoji"
                  aria-hidden="true"
                >
                  {item.image}
                </span>
                <div className="admin-order-card__item-details">
                  <span className="admin-order-card__item-name">
                    {item.name}
                  </span>
                  <span className="admin-order-card__item-qty">
                    Qty: {item.quantity} {item.unit}
                  </span>
                </div>
              </div>
              <div className="admin-order-card__item-price">
                <span className="admin-order-card__item-unit">
                  {formatPrice(item.price)}
                </span>
                <strong className="admin-order-card__item-total">
                  {formatPrice(item.price * item.quantity)}
                </strong>
              </div>
            </div>
          ))}
        </div>
        <div className="admin-order-card__total">
          <span>Total</span>
          <strong>{formatPrice(order.total)}</strong>
        </div>
      </div>

      {!isTerminal && (
        <div className="admin-order-card__actions">
          {isPending && (
            <>
              <button
                type="button"
                className="admin-order-card__btn admin-order-card__btn--success"
                onClick={() => onUpdateStatus(order.id, "delivered")}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                Mark Delivered
              </button>
              <button
                type="button"
                className="admin-order-card__btn admin-order-card__btn--danger"
                onClick={() => onUpdateStatus(order.id, "cancelled")}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
                Cancel Order
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}
