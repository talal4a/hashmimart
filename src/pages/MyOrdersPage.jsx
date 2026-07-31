import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatPrice } from '../data/products'
import { useStore } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'
import { IconPackage } from '../components/Icons'
import { ListSkeleton } from '../components/Skeleton'

const PAGE_SIZE = 10
const STATUS_LABELS = { pending: 'Pending', delivered: 'Delivered', cancelled: 'Cancelled' }

export default function MyOrdersPage() {
  const navigate = useNavigate()
  const { orders, ordersLoading } = useStore()
  const { user } = useAuth()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(PAGE_SIZE)

  const myOrders = useMemo(() => {
    if (!user) return []
    return orders.filter((o) => o.userId === user.id)
  }, [orders, user])

  const filtered = useMemo(() => {
    let result = myOrders
    if (filter !== 'all') result = result.filter((o) => o.status === filter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((o) => (o.id || '').toLowerCase().includes(q))
    }
    return result
  }, [myOrders, filter, search])

  const visibleOrders = filtered.slice(0, visible)
  const hasMore = visible < filtered.length

  const itemCount = (order) => order.items?.length || 0

  return (
    <div className="my-orders-page">
      <div className="my-orders-header">
        <h2>My Orders</h2>
      </div>

      <div className="search-box">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search by order ID..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setVisible(PAGE_SIZE) }}
        />
      </div>

      <div className="admin-filters">
        {['all', 'pending', 'delivered', 'cancelled'].map((f) => (
          <button
            key={f}
            type="button"
            className={`filter-btn ${filter === f ? 'filter-btn-active' : ''}`}
            onClick={() => { setFilter(f); setVisible(PAGE_SIZE) }}
          >
            {f === 'all' ? 'All' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        ordersLoading ? (
          <ListSkeleton count={4} />
        ) : (
          <div className="empty-page">
            <p className="empty-state">
              {myOrders.length === 0
                ? 'You have not placed any orders yet.'
                : 'No orders match your criteria.'}
            </p>
            {myOrders.length === 0 && (
              <Link to="/" className="btn btn-primary">Start Shopping</Link>
            )}
          </div>
        )
      ) : (
        <div className="my-orders-list">
          {visibleOrders.map((order) => (
            <button
              type="button"
              key={order.id}
              className="my-order-card"
              onClick={() => navigate(`/my-orders/${order.id}`)}
            >
              <div className="my-order-card-top">
                <div className="my-order-card-icon">
                  <IconPackage size={24} />
                </div>
                <div className="my-order-card-info">
                  <span className="my-order-card-id">#{order.id}</span>
                  <span className="my-order-card-date">
                    {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-PK', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    }) : 'Unknown date'}
                  </span>
                </div>
                <span className={`status-badge status-badge--${order.status}`}>
                  {STATUS_LABELS[order.status] || order.status}
                </span>
              </div>
              <div className="my-order-card-bottom">
                {order.isVoiceOrder ? (
                  <>
                    <span>🎙 Voice order</span>
                    <span className="my-order-card-total">
                      {order.total > 0 ? formatPrice(order.total) : 'To be decided'}
                    </span>
                  </>
                ) : (
                  <>
                    <span>{itemCount(order)} item{itemCount(order) !== 1 ? 's' : ''}</span>
                    <span className="my-order-card-total">{formatPrice(order.total ?? 0)}</span>
                  </>
                )}
              </div>
            </button>
          ))}

          {hasMore && (
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => setVisible((v) => v + PAGE_SIZE)}
            >
              Load More ({filtered.length - visible} remaining)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
