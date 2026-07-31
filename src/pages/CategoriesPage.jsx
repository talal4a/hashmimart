import { useState } from "react";
import { Link } from "react-router-dom";
import {
  IconPackage,
  IconStore,
  IconDelivery,
  IconFresh,
  IconBestPrice,
  IconDirectOrder,
  IconCategories,
} from "../components/Icons";
import { useAuth } from "../context/AuthContext";
import { useStore } from "../context/StoreContext";
import ProductCard from "../components/ProductCard";
import {
  getCategoryDisplayName,
  getCategoryDescription,
  getCategoryBadge,
} from "../data/categoryStore";
import AnimateOnScroll from "../components/AnimateOnScroll";
import HeroSlider from "../components/HeroSlider";

function CategoryIcon({ name }) {
  if (name === "retail") return <IconStore />;
  if (name === "wholesale") return <IconPackage />;
  return <IconCategories />;
}

export default function CategoriesPage() {
  const { isAuthenticated, isStaff } = useAuth();
  const { categories, orders, products } = useStore();
  const [orderFilter, setOrderFilter] = useState("all");

  /* Dashboard shows only the 5 most recent orders by default. Orders arrive
     newest-first from the store, so slicing off the head is enough. Picking a
     filter shows every matching order. */
  const filteredOrders =
    orderFilter === "all"
      ? orders.slice(0, 5)
      : orders.filter((order) => order.status === orderFilter);

  const discountProducts = products.filter(
    (product) => product.salePrice && product.salePrice < product.price,
  );

  return (
    <div className="categories-page">
      <HeroSlider />
      <section className="hero-section">
        <div className="hero-content animate-slide-up">
          <div className="hero-badge">
            <span>🚀</span>
            <span>Premium Quality</span>
          </div>
          <h1 className="hero-title">Welcome to Hashmi Mart</h1>
          <p className="hero-subtitle">
            Premium fresh groceries delivered fast in Lahore. Shop retail or
            wholesale today!
          </p>
          <div className="hero-features">
            <div className="hero-feature animate-slide-up stagger-1">
              <div className="hero-feature-icon">
                <IconDelivery size={32} />
              </div>
              <div>
                <h3>Fast Delivery</h3>
                <p>Same-day delivery available</p>
              </div>
            </div>
            <div className="hero-feature animate-slide-up stagger-2">
              <div className="hero-feature-icon">
                <IconFresh size={32} />
              </div>
              <div>
                <h3>Fresh Produce</h3>
                <p>Daily fresh from local farms</p>
              </div>
            </div>
            <div className="hero-feature animate-slide-up stagger-3">
              <div className="hero-feature-icon">
                <IconBestPrice size={32} />
              </div>
              <div>
                <h3>Best Prices</h3>
                <p>Competitive wholesale rates</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AnimateOnScroll>
        <div className="category-grid">
          {categories.map((cat, i) => {
            const badge = getCategoryBadge(cat.name);
            return (
              <Link
                key={cat.id}
                to={`/products/${cat.name}`}
                className={`category-card animate-slide-up stagger-${(i % 8) + 1}`}
              >
                <div className="category-card-icon">
                  <CategoryIcon name={cat.name} />
                </div>
                <div className="category-card-content">
                  <h3>{getCategoryDisplayName(cat.name)}</h3>
                  <p>{getCategoryDescription(cat.name)}</p>
                  {badge && (
                    <div className={`category-badge ${badge.className || ""}`}>
                      {badge.text}
                    </div>
                  )}
                </div>
                <span className="category-card-arrow" aria-hidden="true">
                  →
                </span>
              </Link>
            );
          })}

          <Link
            to="/products"
            className={`category-card animate-slide-up stagger-${(categories.length % 8) + 1}`}
          >
            <div className="category-card-icon">
              <IconCategories />
            </div>
            <div className="category-card-content">
              <h3>All Products</h3>
              <p>Browse every product across all categories</p>
              <div className="category-badge">Browse All</div>
            </div>
            <span className="category-card-arrow" aria-hidden="true">
              →
            </span>
          </Link>

          <Link
            to={
              isAuthenticated && !isStaff
                ? "/direct-order"
                : "/login?redirect=%2Fdirect-order"
            }
            className={`category-card animate-slide-up stagger-${((categories.length + 1) % 8) + 1}`}
          >
            <div className="category-card-icon">
              <IconDirectOrder />
            </div>
            <div className="category-card-content">
              <h3>Direct Order</h3>
              <p>Quick order without browsing — tell us what you need</p>
              <div className="category-badge">Express</div>
            </div>
            <span className="category-card-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </AnimateOnScroll>

      {orders.length > 0 && (
        <AnimateOnScroll>
          <div className="orders-section">
            <div className="orders-section-header">
              <h2>Your Orders ({orders.length})</h2>
              <div className="admin-filters">
                <button
                  className={`filter-btn ${orderFilter === "all" ? "filter-btn-active" : ""}`}
                  onClick={() => setOrderFilter("all")}
                >
                  All
                </button>
                <button
                  className={`filter-btn ${orderFilter === "pending" ? "filter-btn-active" : ""}`}
                  onClick={() => setOrderFilter("pending")}
                >
                  Pending
                </button>
                <button
                  className={`filter-btn ${orderFilter === "delivered" ? "filter-btn-active" : ""}`}
                  onClick={() => setOrderFilter("delivered")}
                >
                  Delivered
                </button>
                <button
                  className={`filter-btn ${orderFilter === "cancelled" ? "filter-btn-active" : ""}`}
                  onClick={() => setOrderFilter("cancelled")}
                >
                  Cancelled
                </button>
              </div>
            </div>
            {filteredOrders.length > 0 ? (
              <div className="orders-grid">
                {filteredOrders.map((order) => (
                  <Link
                    key={order.id}
                    to={`/order/${order.id}`}
                    className="order-card"
                  >
                    <div className="order-card-header">
                      <span className="order-id">#{order.id}</span>
                      <span
                        className={`order-status order-status--${order.status}`}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="order-card-body">
                      <p className="order-items">{order.items.length} items</p>
                      <p className="order-total">
                        Rs. {order.total.toLocaleString()}
                      </p>
                    </div>
                    <div className="order-card-footer">
                      <span className="order-date">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                      <span className="order-view">View →</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v8M8 12h8" />
                  </svg>
                </div>
                <h3 className="empty-state-title">
                  Oops, no {orderFilter === "all" ? "" : orderFilter} orders yet
                </h3>
                <p className="empty-state-message">
                  {orderFilter === "all"
                    ? "You haven't placed any orders yet. Start shopping to see your orders here!"
                    : `You don't have any ${orderFilter} orders at the moment.`}
                </p>
              </div>
            )}
          </div>
        </AnimateOnScroll>
      )}

      {discountProducts.length > 0 && (
        <AnimateOnScroll>
          <div className="wishlist-section">
            <h2>Discount Products ({discountProducts.length})</h2>
            <div className="product-grid">
              {discountProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </AnimateOnScroll>
      )}
    </div>
  );
}
