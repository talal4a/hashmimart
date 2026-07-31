import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatPrice } from '../data/products'
import { useStore } from '../context/StoreContext'
import { IconBack } from '../components/Icons'
import ConfirmDialog from '../components/ConfirmDialog'
import { SkeletonBlock } from '../components/Skeleton'

export default function MyOrderDetailPage() {
  const { orderId } = useParams()
  const navigate = useNavigate()
  const { orders, cancelUserOrder, ordersLoading } = useStore()
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  const order = orders.find((o) => o.id === orderId)

  if (!order) {
    if (ordersLoading) {
      return (
        <div className="my-order-detail-page">
          <div className="status-card">
            <SkeletonBlock style={{ width: '50%', height: '22px', marginBottom: '0.75rem' }} />
            <SkeletonBlock style={{ width: '30%', height: '16px', marginBottom: '1rem' }} />
            <SkeletonBlock style={{ width: '100%', height: '60px' }} />
          </div>
        </div>
      )
    }
    return (
      <div className="empty-page">
        <p className="empty-state">Order not found</p>
        <Link to="/my-orders" className="btn btn-secondary">Back to Orders</Link>
      </div>
    )
  }

  const handleCancel = async () => {
    setShowConfirm(false)
    setCancelling(true)
    setCancelError('')
    try {
      await cancelUserOrder(order.id)
      navigate('/my-orders')
    } catch (err) {
      setCancelError(err.message || 'Failed to cancel order.')
    } finally {
      setCancelling(false)
    }
  }

  const statusLabels = { pending: 'Pending', delivered: 'Delivered', cancelled: 'Cancelled' }

  return (
    <div className="my-order-detail-page">
      <button
        type="button"
        className="btn btn-secondary btn-back-inline"
        onClick={() => navigate('/my-orders')}
      >
        <IconBack size={18} /> Back to Orders
      </button>

      <div className="status-card">
        <h2>Order #{order.id}</h2>
        <span className={`status-badge status-badge--${order.status} order-detail-badge`}>
          {statusLabels[order.status] || order.status}
        </span>
        <p className="order-detail-placed">
          Placed on {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-PK', {
            year: 'numeric', month: 'long', day: 'numeric',
          }) : 'Unknown date'}
        </p>

        {cancelError && <div className="field-error order-detail-error">{cancelError}</div>}

        {order.status === 'pending' && (
          <button
            type="button"
            className="btn btn-danger btn-block order-detail-cancel-btn"
            onClick={() => setShowConfirm(true)}
            disabled={cancelling}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Order'}
          </button>
        )}
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="Cancel Order"
          message="Are you sure you want to cancel this order? This can't be undone."
          confirmLabel="Cancel Order"
          cancelLabel="Keep Order"
          onConfirm={handleCancel}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      <div className="order-detail-section">
        <h3>Customer</h3>
        <p><strong>{order.customer?.fullName || 'Unknown User'}</strong></p>
        <p>{order.customer?.phone || 'No phone number'}</p>
        {(order.customer?.email) && <p>{order.customer.email}</p>}
      </div>

      <div className="order-detail-section">
        <h3>Delivery Address</h3>
        <p>{order.customer?.address || 'No address provided'}</p>
        <p className="order-detail-muted">
          {order.customer?.city || 'Lahore'}
        </p>
      </div>

      <div className="order-detail-section">
        <h3>Payment</h3>
        <p>{order.paymentMethod}</p>
        <p className="my-order-card-total order-detail-total">
          Total: {formatPrice(order.total)}
        </p>
      </div>

      <div className="order-detail-section">
        {order.isVoiceOrder ? (
          <>
            <h3>🎙 Voice Request</h3>
            <div className="admin-order__voice-box">
              <p className="admin-order__voice-msg">
                You sent this voice note. Our team will confirm the items and total.
              </p>
              {order.audioUrl ? (
                <audio controls src={order.audioUrl} className="admin-order__audio" />
              ) : (
                <p className="admin-order__voice-error">Audio URL not found.</p>
              )}
            </div>
            <div className="summary-total">
              <span>Total</span>
              <strong>{order.total > 0 ? formatPrice(order.total) : 'To be decided'}</strong>
            </div>
          </>
        ) : (
          <>
            <h3>Products ({order.items?.length || 0})</h3>
            <ul className="summary-list">
              {(order.items || []).map((item) => (
                <li key={item.productId}>
                  <span>
                    <span className="item-emoji" aria-hidden="true">{item.image}</span>
                    {item.name} × {item.quantity}
                  </span>
                  <span>{formatPrice(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="summary-total">
              <span>Total</span>
              <strong>{formatPrice(order.total)}</strong>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
