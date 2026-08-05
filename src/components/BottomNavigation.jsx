import { Link, useLocation } from 'react-router-dom'
import { IconCart, IconHeart, IconHome, IconCategories, IconAccount } from './Icons'
import { useStore } from '../context/StoreContext'
import { useAuth } from '../context/AuthContext'

export default function BottomNavigation() {
  const location = useLocation()
  const { cartCount, unreadNotifications } = useStore()
  const { isAuthenticated } = useAuth()
  const isAdmin = location.pathname.startsWith('/admin')
  
  if (isAdmin) return null

  const navItems = [
    { 
      to: '/', 
      icon: <IconHome />, 
      label: 'Home',
      isHome: true
    },
    { 
      to: '/products/retail', 
      icon: <IconCategories />, 
      label: 'Categories'
    },
    { 
      to: '/wishlist', 
      icon: <IconHeart />, 
      label: 'Wishlist'
    },
    { 
      to: '/cart', 
      icon: <IconCart />, 
      label: 'Cart',
      badge: cartCount > 0 ? cartCount : null
    },
    isAuthenticated
      ? {
          to: '/notifications',
          icon: <IconAccount />,
          label: 'Account',
          badge: unreadNotifications.length > 0 ? unreadNotifications.length : null,
        }
      : {
          to: '/login',
          icon: <IconAccount />,
          label: 'Login',
        },
  ]

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const isActive = location.pathname === item.to || 
                        (item.to === '/products/retail' && location.pathname.startsWith('/products/'))
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`bottom-nav-item ${isActive ? 'bottom-nav-item-active' : ''}`}
          >
            <div className={`bottom-nav-icon-wrapper ${item.isHome ? 'bottom-nav-icon-home' : ''}`}>
              {item.icon}
              {item.badge && <span className="bottom-nav-badge">{item.badge}</span>}
            </div>
            <span className="bottom-nav-label">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
