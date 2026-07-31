import { Link, useParams } from 'react-router-dom'
import { formatPrice } from '../data/products'
import { useStore } from '../context/StoreContext'
import { IconCheck, IconX } from '../components/Icons'
import { SkeletonBlock } from '../components/Skeleton'

const STATUS_CONFIG = {
  pending: {
    title: 'Order Placed!',
    message: 'Your order has been placed. The rider will contact you shortly.',
    icon: 'pulse',
    className: 'pending',
  },
  delivered: {
    title: 'Order Delivered!',
    message: 'Your order has been delivered.',
    icon: 'check',
    className: 'delivered',
  },
  cancelled: {
    title: 'Order Cancelled!',
    message: 'Your order has been cancelled.',
    icon: 'x',
    className: 'cancelled',
  },
}

export default function OrderStatusPage() {
  const { orderId } = useParams()
  const { orders, ordersLoading } = useStore()
  const order = orders.find((o) => o.id === orderId)

  if (!order) {
    if (ordersLoading) {
      return (
        <div className="order-status-page">
          <div className="status-card">
            <SkeletonBlock style={{ width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 1rem' }} />
            <SkeletonBlock style={{ width: '60%', height: '20px', margin: '0 auto 0.75rem' }} />
            <SkeletonBlock style={{ width: '40%', height: '14px', margin: '0 auto 1.5rem' }} />
            <SkeletonBlock style={{ width: '100%', height: '80px' }} />
          </div>
        </div>
      )
    }
    return (
      <div className="empty-page">
        <p className="empty-state">Order not found</p>
        <Link to="/" className="btn btn-secondary">Go Home</Link>
      </div>
    )
  }

  const config = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending

  return (
    <div className="order-status-page">
      <div className="status-card">
        <div className={`status-icon status-icon--${config.className}`}>
          {config.icon === 'check' && <IconCheck size={32} />}
          {config.icon === 'x' && <IconX size={32} />}
          {config.icon === 'pulse' && <span className="status-pulse" />}
        </div>

        <h2>{config.title}</h2>
        <p className="order-id">Order #{order.id}</p>

        <div className={`status-message status-message--${config.className}`}>
          <p>{config.message}</p>
        </div>

        <div className="order-details">
          <h3>Delivery to</h3>
          <p>{order.customer.fullName}</p>
          <p>{order.customer.phone}</p>
          <p>{order.customer.address}</p>
        </div>

        <div className="order-details">
          <h3>Items</h3>
          <ul className="summary-list">
            {order.items.map((item) => (
              <li key={item.productId}>
                <span>{item.name} × {item.quantity}</span>
                <span>{formatPrice(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="summary-total">
            <span>Total (COD)</span>
            <strong>{formatPrice(order.total)}</strong>
          </div>
        </div>

        <Link to="/" className="btn btn-secondary btn-block">Continue Shopping</Link>
      </div>
    </div>
  )
}
