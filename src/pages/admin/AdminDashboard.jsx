import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { formatPrice } from "../../data/products";
import { useStore } from "../../context/StoreContext";
import { useAuth } from "../../context/AuthContext";
import {
  canAccessSection,
  sectionBySlug,
  sectionsForRole,
} from "../../lib/permissions";
import { IconTrash, IconPlus } from "../../components/Icons";
import { Edit, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import AccessDenied from "./AccessDenied";
import ConfirmDialog from "../../components/ConfirmDialog";
import AddItemPage from "./AddItemPage";
function SparklineCard({ icon, color, title, value, data }) {
  const width = 100;
  const height = 40;

  let path, fillPath, circleCx, circleCy;

  if (!data || data.length <= 1) {
    path = `M0,35 C30,35 40,35 50,35 C60,35 70,35 100,35`;
    fillPath = `M0,35 C30,35 40,35 50,35 C60,35 70,35 100,35 L100,40 L0,40 Z`;
    circleCx = width;
    circleCy = height - 5;
  } else {
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = 35 - ((d - min) / range) * 30;
      return { x, y };
    });

    path = `M${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const cx = (p0.x + p1.x) / 2;
      path += ` C${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
    }

    fillPath = `${path} L${width},${height} L0,${height} Z`;
    circleCx = points[points.length - 1].x;
    circleCy = points[points.length - 1].y;
  }

  const colors = {
    orange: { stroke: "#ea580c", fill: "rgba(249, 115, 22, 0.1)" },
    blue: { stroke: "#0284c7", fill: "rgba(14, 165, 233, 0.1)" },
    green: { stroke: "#16a34a", fill: "rgba(34, 197, 94, 0.1)" },
    amber: { stroke: "#d97706", fill: "rgba(245, 158, 11, 0.1)" },
    indigo: { stroke: "#4f46e5", fill: "rgba(99, 102, 241, 0.1)" },
  };

  const theme = colors[color] || colors.orange;
  const iconClassMap = {
    orange: "admin-stat-card__icon--indigo",
    blue: "admin-stat-card__icon--cyan",
    green: "admin-stat-card__icon--green",
    amber: "admin-stat-card__icon--amber",
    indigo: "admin-stat-card__icon--indigo",
  };

  return (
    <div className="admin-stat-card">
      <div
        className={`admin-stat-card__icon ${iconClassMap[color] || iconClassMap.orange}`}
      >
        {icon}
      </div>
      <div className="admin-stat-card__content">
        <span className="admin-stat-card__value">{value}</span>
        <span className="admin-stat-card__label">{title}</span>
      </div>
      <svg
        className="admin-stat-card__chart"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <path d={fillPath} fill={theme.fill} />
        <path d={path} fill="none" stroke={theme.stroke} strokeWidth="1.5" />
        <circle cx={circleCx} cy={circleCy} r="2" fill={theme.stroke} />
      </svg>
    </div>
  );
}

// Generate dynamic trend data for sparklines
const generateTrendData = (items, valueExtractor = () => 1) => {
  const counts = Array(7).fill(0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  items.forEach((item) => {
    if (!item.createdAt) return;
    const d = new Date(item.createdAt);
    d.setHours(0, 0, 0, 0);
    const diffTime = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays < 7) {
      counts[6 - diffDays] += valueExtractor(item);
    }
  });
  return counts;
};

function Toast({ message, type, onClose }) {
  const getIcon = () => {
    if (type === "success") {
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    } else if (type === "error") {
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    } else if (type === "info") {
      return (
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
    }
    return null;
  };

  return (
    <div className={`toast toast--${type}`}>
      <div className="toast__icon">{getIcon()}</div>
      <span className="toast__message">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="toast__close"
        aria-label="Close"
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
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function OrderCard({ order, onUpdateStatus, selected, onToggleSelect }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const isPending = order.status === "pending";
  const isConfirmed = order.status === "confirmed";
  const isTerminal =
    order.status === "delivered" || order.status === "cancelled";
  const canDelete = isTerminal && order.dbId;
  const handleUpdate = async (newStatus) => {
    setIsUpdating(true);
    try {
      await onUpdateStatus(order.id, newStatus);
    } finally {
      setIsUpdating(false);
    }
  };
  return (
    <article className={`admin-order admin-order--${order.status}`}>
      <header className="admin-order__header">
        <div className="admin-order__header-left">
          {canDelete && (
            <label
              className="admin-order__checkbox"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect(order.dbId)}
              />
            </label>
          )}
          <div className="admin-order__id">
            <h3 className="admin-order__number">#{order.id}</h3>
            <time className="admin-order__time">
              {new Date(order.createdAt).toLocaleString("en-PK", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </div>
        </div>
        <span
          className={`admin-order__status admin-order__status--${order.status}`}
        >
          {order.status}
        </span>
      </header>

      <div className="admin-order__body">
        <div className="admin-order__section">
          <h4 className="admin-order__section-title">Customer Details</h4>
          <div className="admin-order__customer-grid">
            <div className="admin-order__detail">
              <span className="admin-order__detail-label">Name</span>
              <span className="admin-order__detail-value">
                {order.customer?.fullName || "Unknown User"}
              </span>
            </div>
            <div className="admin-order__detail">
              <span className="admin-order__detail-label">Phone</span>
              <span className="admin-order__detail-value">
                {order.customer?.phone || "No phone"}
              </span>
            </div>
            {order.customer?.email && (
              <div className="admin-order__detail">
                <span className="admin-order__detail-label">Email</span>
                <span className="admin-order__detail-value">
                  {order.customer.email}
                </span>
              </div>
            )}
            <div className="admin-order__detail admin-order__detail--full">
              <span className="admin-order__detail-label">Payment</span>
              <span className="admin-order__detail-value admin-order__payment-badge">
                {order.paymentMethod}
              </span>
            </div>
          </div>
          <div className="admin-order__address-row">
            <span className="admin-order__detail-label">Address</span>
            <span className="admin-order__detail-value">
              {order.customer?.address || "No address provided"}
            </span>
          </div>
          {order.customer?.society && (
            <div className="admin-order__address-row">
              <span className="admin-order__detail-label">Society</span>
              <span className="admin-order__detail-value">
                {order.customer.society}
              </span>
            </div>
          )}
        </div>

        <div className="admin-order__divider" />

        <div className="admin-order__section">
          <h4 className="admin-order__section-title">
            {order.isVoiceOrder ? "🎙 Voice Request" : "📦 Products"}
          </h4>
          {order.isVoiceOrder ? (
            <div className="admin-order__voice-box">
              <p className="admin-order__voice-msg">
                This customer sent a voice note. Listen to fulfill their order.
              </p>
              {order.audioUrl ? (
                <audio
                  controls
                  src={order.audioUrl}
                  className="admin-order__audio"
                />
              ) : (
                <p className="admin-order__voice-error">Audio URL not found.</p>
              )}
            </div>
          ) : (
            <div className="w-full overflow-x-auto scrollbar-none my-2">
              <table className="admin-order__table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((item) => (
                    <tr key={item.productId}>
                      <td>
                        <span className="admin-order__item-emoji">
                          {item.image}
                        </span>
                        {item.name}
                      </td>
                      <td>
                        {item.quantity} {item.unit}
                      </td>
                      <td>{formatPrice(item.price)}</td>
                      <td className="admin-order__subtotal">
                        {formatPrice(item.price * item.quantity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="3">
                      <strong>Total</strong>
                    </td>
                    <td>
                      <strong className="admin-order__total-val">
                        {formatPrice(order.total)}
                      </strong>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {!isTerminal && (
        <footer className="admin-order__footer">
          {isPending && (
            <>
              <button
                type="button"
                className="admin-order__action-btn admin-order__action-btn--deliver"
                onClick={() => handleUpdate("confirmed")}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <svg className="admin-order__spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                ) : (
                  "Confirm Order"
                )}
              </button>
              <button
                type="button"
                className="admin-order__action-btn admin-order__action-btn--cancel"
                onClick={() => handleUpdate("cancelled")}
                disabled={isUpdating}
              >
                {isUpdating ? "..." : "Cancel Order"}
              </button>
            </>
          )}
          {isConfirmed && (
            <>
              <button
                type="button"
                className="admin-order__action-btn admin-order__action-btn--deliver"
                onClick={() => handleUpdate("delivered")}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <svg className="admin-order__spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                ) : (
                  "✓ Mark Delivered"
                )}
              </button>
              <button
                type="button"
                className="admin-order__action-btn admin-order__action-btn--cancel"
                onClick={() => handleUpdate("cancelled")}
                disabled={isUpdating}
              >
                {isUpdating ? "..." : "✖ Cancel Order"}
              </button>
            </>
          )}
        </footer>
      )}
    </article>
  );
}

function ProductCard({ product, onEdit, onToggleStock, onDeleteProduct }) {
  const hasDiscount =
    product.salePrice != null && product.salePrice < product.price;

  return (
    <div className="product-card admin-product-card">
      <div className="product-card-top">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="product-card-image"
          />
        ) : (
          <span className="product-card-emoji">{product.image}</span>
        )}
        {hasDiscount && <span className="discount-chip">Discount</span>}
      </div>
      <div className="product-card-body">
        <h3 className="product-card-name">
          {product.name}
          {!product.inStock && (
            <span className="out-of-stock-tag">[Out of Stock]</span>
          )}
        </h3>
        <p className="product-card-desc">{product.description}</p>
        <p className="product-card-price">
          {hasDiscount ? (
            <>
              <span className="product-card-sale">
                {formatPrice(product.salePrice)}
              </span>
              <span className="product-card-original">
                {formatPrice(product.price)}
              </span>
            </>
          ) : (
            formatPrice(product.price)
          )}
          <span className="product-card-unit">/{product.unit}</span>
        </p>
        {product.productCategory && (
          <span className="tag">{product.productCategory}</span>
        )}
      </div>
      <div className="admin-product-card__actions">
        <button
          className="admin-product-card__icon-btn"
          onClick={() => onToggleStock(product.id)}
          title={product.inStock ? "Mark Out of Stock" : "Mark In Stock"}
        >
          {product.inStock ? (
            <ToggleRight size={18} />
          ) : (
            <ToggleLeft size={18} />
          )}
        </button>
        <button
          className="admin-product-card__icon-btn"
          onClick={() => onEdit(product)}
          title="Edit"
        >
          <Edit size={18} />
        </button>
        <button
          className="admin-product-card__icon-btn admin-product-card__icon-btn--danger"
          onClick={() => onDeleteProduct(product.id)}
          title="Delete"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
}

function DiscountManager({ products, onUpdateProduct }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [toast, setToast] = useState(null);

  const discountedProducts = products.filter(
    (p) => p.salePrice != null && p.salePrice < p.price,
  );
  const nonDiscountedProducts = products.filter(
    (p) => p.salePrice == null || p.salePrice >= p.price,
  );

  const productsTrend = useMemo(() => generateTrendData(products), [products]);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleProductClick = (product) => {
    setSelectedProduct(product);
    if (product.salePrice && product.salePrice < product.price) {
      if (discountType === "percentage") {
        const discountPercent = Math.round(
          ((product.price - product.salePrice) / product.price) * 100,
        );
        setDiscountAmount(discountPercent.toString());
      } else {
        setDiscountAmount((product.price - product.salePrice).toString());
      }
    } else {
      setDiscountAmount("");
    }
  };

  const handleApplyDiscount = () => {
    if (!selectedProduct || !discountAmount) return;

    let salePrice;
    if (discountType === "percentage") {
      const percent = parseFloat(discountAmount);
      if (isNaN(percent) || percent < 0 || percent > 100) {
        showToast("Invalid percentage", "error");
        return;
      }
      salePrice = selectedProduct.price * (1 - percent / 100);
    } else {
      const amount = parseFloat(discountAmount);
      if (isNaN(amount) || amount < 0 || amount >= selectedProduct.price) {
        showToast("Invalid discount amount", "error");
        return;
      }
      salePrice = selectedProduct.price - amount;
    }

    onUpdateProduct(selectedProduct.id, {
      salePrice: Math.round(salePrice * 100) / 100,
    });
    showToast("Discount applied successfully", "success");
    setSelectedProduct(null);
    setDiscountAmount("");
  };

  const handleRemoveDiscount = () => {
    if (!selectedProduct) return;
    onUpdateProduct(selectedProduct.id, { salePrice: null });
    showToast("Discount removed", "success");
    setSelectedProduct(null);
    setDiscountAmount("");
  };

  return (
    <div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="admin-stats-row">
        <SparklineCard
          icon="🔥"
          color="green"
          title="Products on Discount"
          value={discountedProducts.length}
          data={[]}
        />
        <SparklineCard
          icon="📦"
          color="blue"
          title="Total Products"
          value={products.length}
          data={productsTrend}
        />
      </div>

      {!selectedProduct ? (
        <>
          <h2 className="section-title">Products with Discounts</h2>
          {discountedProducts.length === 0 ? (
            <div className="empty-page">
              <p className="empty-state">No products with discounts yet.</p>
            </div>
          ) : (
            <div className="product-grid">
              {discountedProducts.map((product) => (
                <div
                  key={product.id}
                  className="product-card admin-product-card clickable"
                  onClick={() => handleProductClick(product)}
                >
                  <div className="product-card-top">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="product-card-image"
                      />
                    ) : (
                      <span className="product-card-emoji">
                        {product.image}
                      </span>
                    )}
                    <span className="discount-chip">Discount</span>
                  </div>
                  <div className="product-card-body">
                    <h3 className="product-card-name">{product.name}</h3>
                    <p className="product-card-price">
                      <span className="product-card-sale">
                        {formatPrice(product.salePrice)}
                      </span>
                      <span className="product-card-original">
                        {formatPrice(product.price)}
                      </span>
                      <span className="product-card-unit">/{product.unit}</span>
                    </p>
                    <p className="discount-info">
                      Save:{" "}
                      {Math.round(
                        ((product.price - product.salePrice) / product.price) *
                          100,
                      )}
                      %
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 className="section-title" style={{ marginTop: "2rem" }}>
            Add Discount to Product
          </h2>
          <div className="product-grid">
            {nonDiscountedProducts.map((product) => (
              <div
                key={product.id}
                className="product-card admin-product-card clickable"
                onClick={() => handleProductClick(product)}
              >
                <div className="product-card-top">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="product-card-image"
                    />
                  ) : (
                    <span className="product-card-emoji">{product.image}</span>
                  )}
                </div>
                <div className="product-card-body">
                  <h3 className="product-card-name">{product.name}</h3>
                  <p className="product-card-price">
                    {formatPrice(product.price)}
                    <span className="product-card-unit">/{product.unit}</span>
                  </p>
                  <p className="discount-info">No discount</p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="discount-detail-panel">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedProduct(null)}
          >
            ← Back to Products
          </button>

          <div className="product-detail-view">
            <div className="product-detail-image">
              {selectedProduct.imageUrl ? (
                <img
                  src={selectedProduct.imageUrl}
                  alt={selectedProduct.name}
                />
              ) : (
                <span className="product-card-emoji large">
                  {selectedProduct.image}
                </span>
              )}
            </div>

            <div className="product-detail-info">
              <h2>{selectedProduct.name}</h2>
              <p className="product-detail-desc">
                {selectedProduct.description}
              </p>

              <div className="price-display">
                <span className="label">Original Price:</span>
                <span className="value">
                  {formatPrice(selectedProduct.price)}
                </span>
              </div>

              {selectedProduct.salePrice &&
              selectedProduct.salePrice < selectedProduct.price ? (
                <div className="price-display">
                  <span className="label">Current Sale Price:</span>
                  <span className="value sale-price">
                    {formatPrice(selectedProduct.salePrice)}
                  </span>
                </div>
              ) : null}

              <div className="discount-form">
                <h3>Apply Discount</h3>

                <div className="discount-type-toggle">
                  <button
                    className={`btn btn-sm ${discountType === "percentage" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setDiscountType("percentage")}
                  >
                    Percentage (%)
                  </button>
                  <button
                    className={`btn btn-sm ${discountType === "fixed" ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setDiscountType("fixed")}
                  >
                    Fixed Amount
                  </button>
                </div>

                <div className="field">
                  <label className="field-label">
                    {discountType === "percentage"
                      ? "Discount Percentage"
                      : "Discount Amount"}
                  </label>
                  <input
                    type="number"
                    className="text-input"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    placeholder={
                      discountType === "percentage" ? "e.g., 20" : "e.g., 50"
                    }
                    min="0"
                    max={
                      discountType === "percentage"
                        ? "100"
                        : selectedProduct.price
                    }
                  />
                </div>

                <div className="discount-preview">
                  {discountAmount && (
                    <p>
                      Preview: {formatPrice(selectedProduct.price)} →{" "}
                      <span className="sale-price">
                        {formatPrice(
                          discountType === "percentage"
                            ? selectedProduct.price *
                                (1 - parseFloat(discountAmount) / 100)
                            : selectedProduct.price -
                                parseFloat(discountAmount),
                        )}
                      </span>
                    </p>
                  )}
                </div>

                <div className="form-actions-row">
                  <button
                    className="btn btn-primary"
                    onClick={handleApplyDiscount}
                    disabled={!discountAmount}
                  >
                    Apply Discount
                  </button>
                  {selectedProduct.salePrice &&
                    selectedProduct.salePrice < selectedProduct.price && (
                      <button
                        className="btn btn-danger"
                        onClick={handleRemoveDiscount}
                      >
                        Remove Discount
                      </button>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCategoriesManager({
  productCategories,
  products,
  onAdd,
  onEdit,
  onDelete,
  onNavigateToProducts,
}) {
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [editingCat, setEditingCat] = useState(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const categoriesTrend = useMemo(
    () => generateTrendData(productCategories),
    [productCategories],
  );
  const productsTrend = useMemo(() => generateTrendData(products), [products]);

  const productCountMap = useMemo(() => {
    const map = {};
    products.forEach((p) => {
      const key = p.productCategory || "Uncategorized";
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    if (!search.trim()) return productCategories;
    const q = search.toLowerCase();
    return productCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [productCategories, search]);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // These three handlers call async context functions. Without await, `result`
  // is a pending Promise, `result?.error` is always undefined, and every
  // failure reported success.
  const handleAdd = async () => {
    const result = await onAdd(newName);
    if (result?.error) {
      showToast(result.error, "error");
    } else {
      showToast("Category added", "success");
      setNewName("");
    }
  };

  const handleEdit = async () => {
    if (!editingCat) return;
    const result = await onEdit(editingCat.id, editName);
    if (result?.error) {
      showToast(result.error, "error");
    } else {
      showToast("Category updated", "success");
      setEditingCat(null);
      setEditName("");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await onDelete(deleteTarget.id);
    if (result?.error) {
      showToast(result.error, "error");
    } else {
      showToast("Category deleted", "success");
    }
    setDeleteTarget(null);
  };

  return (
    <div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={`Delete "${deleteTarget.name}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="admin-stats-row">
        <SparklineCard
          icon="🏷️"
          color="orange"
          title="Categories"
          value={productCategories.length}
          data={categoriesTrend}
        />
        <SparklineCard
          icon="📦"
          color="blue"
          title="Products"
          value={products.length}
          data={productsTrend}
        />
      </div>

      <div className="search-box search-box--mb">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search categories..."
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="category-add-row">
        <input
          type="text"
          className="text-input category-add-row__input"
          placeholder="New category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button className="btn btn-primary btn-icon-inline" onClick={handleAdd}>
          <IconPlus size={18} />
          Add
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-page">
          <p className="empty-state">
            {search
              ? `No categories matching "${search}"`
              : "No product categories yet."}
          </p>
        </div>
      ) : (
        <div className="category-list">
          {filtered.map((cat) => {
            const count = productCountMap[cat.name] || 0;
            const isEditing = editingCat?.id === cat.id;
            return (
              <div key={cat.id} className="category-row">
                {isEditing ? (
                  <div className="category-row__edit">
                    <input
                      type="text"
                      className="text-input category-row__edit-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleEdit();
                        }
                      }}
                      autoFocus
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleEdit}
                    >
                      Save
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditingCat(null);
                        setEditName("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div
                      className="category-row__info clickable"
                      onClick={() =>
                        onNavigateToProducts && onNavigateToProducts(cat.name)
                      }
                    >
                      <div className="category-row__name">{cat.name}</div>
                      <div className="category-row__meta">
                        {count} product{count !== 1 ? "s" : ""}
                        {cat.createdAt && (
                          <span>
                            {" "}
                            ·{" "}
                            {new Date(cat.createdAt).toLocaleDateString(
                              "en-PK",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm category-row__action"
                      onClick={() => {
                        setEditingCat(cat);
                        setEditName(cat.name);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm category-row__delete"
                      onClick={() => setDeleteTarget(cat)}
                    >
                      <IconTrash size={16} />
                      Delete
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SocietiesManager({ societies, orders, onAdd, onEdit, onDelete }) {
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [editingSociety, setEditingSociety] = useState(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const societiesTrend = useMemo(
    () => generateTrendData(societies),
    [societies],
  );

  // Orders already placed into each society. Shown as context so an admin can
  // see which areas are actually being served before renaming or removing one.
  const orderCountMap = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const key = o.customer?.society;
      if (key) map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    if (!search.trim()) return societies;
    const q = search.toLowerCase();
    return societies.filter((s) => s.name.toLowerCase().includes(q));
  }, [societies, search]);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAdd = async () => {
    const result = await onAdd(newName);
    if (result?.error) {
      showToast(result.error, "error");
    } else {
      showToast("Society added", "success");
      setNewName("");
    }
  };

  const handleEdit = async () => {
    if (!editingSociety) return;
    const result = await onEdit(editingSociety.id, editName);
    if (result?.error) {
      showToast(result.error, "error");
    } else {
      showToast("Society updated", "success");
      setEditingSociety(null);
      setEditName("");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await onDelete(deleteTarget.id);
    if (result?.error) {
      showToast(result.error, "error");
    } else {
      showToast("Society deleted", "success");
    }
    setDeleteTarget(null);
  };

  return (
    <div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          message={
            orderCountMap[deleteTarget.name]
              ? `Delete "${deleteTarget.name}"? ${orderCountMap[deleteTarget.name]} existing order(s) reference it — they keep their saved society, but customers can no longer pick it. This cannot be undone.`
              : `Delete "${deleteTarget.name}"? This action cannot be undone.`
          }
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="admin-stats-row">
        <SparklineCard
          icon="🏘️"
          color="green"
          title="Societies"
          value={societies.length}
          data={societiesTrend}
        />
        <SparklineCard
          icon="🧾"
          color="blue"
          title="Orders Placed"
          value={orders.length}
          data={generateTrendData(orders)}
        />
      </div>

      <div className="search-box search-box--mb">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          placeholder="Search societies..."
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="category-add-row">
        <input
          type="text"
          className="text-input category-add-row__input"
          placeholder="New society name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button className="btn btn-primary btn-icon-inline" onClick={handleAdd}>
          <IconPlus size={18} />
          Add
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-page">
          <p className="empty-state">
            {search
              ? `No societies matching "${search}"`
              : "No societies yet. Add one so customers can pick it at checkout."}
          </p>
        </div>
      ) : (
        <div className="category-list">
          {filtered.map((society) => {
            const count = orderCountMap[society.name] || 0;
            const isEditing = editingSociety?.id === society.id;
            return (
              <div key={society.id} className="category-row">
                {isEditing ? (
                  <div className="category-row__edit">
                    <input
                      type="text"
                      className="text-input category-row__edit-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleEdit();
                        }
                      }}
                      autoFocus
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleEdit}
                    >
                      Save
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditingSociety(null);
                        setEditName("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="category-row__info">
                      <div className="category-row__name">{society.name}</div>
                      <div className="category-row__meta">
                        {count} order{count !== 1 ? "s" : ""}
                        {society.createdAt && (
                          <span>
                            {" "}
                            ·{" "}
                            {new Date(society.createdAt).toLocaleDateString(
                              "en-PK",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm category-row__action"
                      onClick={() => {
                        setEditingSociety(society);
                        setEditName(society.name);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm category-row__delete"
                      onClick={() => setDeleteTarget(society)}
                    >
                      <IconTrash size={16} />
                      Delete
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const {
    orders,
    updateOrderStatus,
    deleteOrders,
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    toggleProductStock,
    wishlist,
    productCategories,
    addProductCategory,
    editProductCategory,
    deleteProductCategory,
    societies,
    addSociety,
    editSociety,
    deleteSociety,
  } = useStore();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { section: sectionSlug } = useParams();
  const [filter, setFilter] = useState("all");
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productFilter, setProductFilter] = useState("all");

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const [deleteProductTarget, setDeleteProductTarget] = useState(null);
  const [editProductTarget, setEditProductTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const navRef = useRef(null);

  // Active section is driven entirely by the URL (/admin/:section), so a
  // manually-typed or bookmarked section deep-link works and the browser
  // back/forward buttons move between sections.
  const role = profile?.role;
  const activeSection = sectionBySlug(sectionSlug);
  const activeTab = activeSection?.key;
  const visibleSections = sectionsForRole(role);
  const goToSection = (path) => navigate(path);

  const { loadRecentOrders } = useStore();

  // Scroll active tab into view when tab changes
  useEffect(() => {
    if (navRef.current && activeTab) {
      const activeButton = navRef.current.querySelector(
        `[data-tab="${activeTab}"]`,
      );
      if (activeButton) {
        activeButton.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    }
  }, [activeTab]);

  // Load recent orders for the dashboard widget
  useEffect(() => {
    if (activeTab === "orders") {
      loadRecentOrders().then(setRecentOrders);
    }
  }, [activeTab, loadRecentOrders]);

  const filteredOrders = orders.filter(
    (o) => filter === "all" || o.status === filter,
  );
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const terminalOrders = orders.filter(
    (o) => (o.status === "delivered" || o.status === "cancelled") && o.dbId,
  );
  const hasTerminalOrders = terminalOrders.length > 0;

  const orderTrend = useMemo(() => generateTrendData(orders), [orders]);
  const revenueTrend = useMemo(
    () =>
      generateTrendData(
        orders.filter((o) => o.status === "delivered"),
        (o) => o.total || 0,
      ),
    [orders],
  );
  const wishlistTrend = useMemo(() => generateTrendData(wishlist), [wishlist]);

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleSelect = (dbId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(dbId)) next.delete(dbId);
      else next.add(dbId);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    try {
      const count = await deleteOrders([...selectedIds]);
      setSelectedIds(new Set());
      showToast(`Hidden ${count} order${count !== 1 ? "s" : ""}.`, "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleDeleteAllHistory = async () => {
    setShowConfirmDeleteAll(false);
    try {
      const dbIds = terminalOrders.map((o) => o.dbId);
      if (dbIds.length === 0) return;
      const count = await deleteOrders(dbIds);
      showToast(`Hidden ${count} order${count !== 1 ? "s" : ""}.`, "success");
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const filteredProducts = products.filter((p) => {
    return productFilter === "all" || p.productCategory === productFilter;
  });

  const handleAddProduct = async (productData) => {
    const result = await addProduct(productData);
    if (result?.error) {
      showToast(result.error, "error");
      return;
    }
    setShowProductForm(false);
    showToast("Product added successfully", "success");
  };

  const handleUpdateProduct = async (productData) => {
    const result = await updateProduct(editingProduct.id, productData);
    if (result?.error) {
      showToast(result.error, "error");
      return;
    }
    setEditingProduct(null);
    setShowProductForm(false);
    showToast("Product updated successfully", "success");
  };

  const handleEditProduct = (product) => {
    setEditProductTarget(product);
  };

  // Silence on success: the card's own state flip is the confirmation. Only a
  // rejected write needs saying out loud.
  const handleToggleStock = async (id) => {
    const result = await toggleProductStock(id);
    if (result?.error) showToast(result.error, "error");
  };

  const confirmEditProduct = () => {
    if (!editProductTarget) return;
    setEditingProduct(editProductTarget);
    setShowProductForm(true);
    setEditProductTarget(null);
  };

  const handleDeleteProduct = (productId) => {
    setDeleteProductTarget(productId);
  };

  const confirmDeleteProduct = async () => {
    if (!deleteProductTarget) return;
    const result = await deleteProduct(deleteProductTarget);
    setDeleteProductTarget(null);
    if (result?.error) {
      showToast(result.error, "error");
    } else {
      showToast("Product deleted successfully", "success");
    }
  };

  if (!activeSection || !canAccessSection(role, activeTab)) {
    return <AccessDenied />;
  }

  return (
    <div className="admin-dashboard max-w-full overflow-x-hidden">
      {/* ── Dashboard Header ── */}
      <div className="admin-header">
        <div className="admin-header__title">
          <h1 className="admin-header__heading">Dashboard</h1>
          <p className="admin-header__subtitle">
            Manage your store orders, products &amp; more
          </p>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <nav className="admin-nav" ref={navRef}>
        {visibleSections.map((s) => (
          <button
            key={s.key}
            data-tab={s.key}
            className={`admin-nav__item ${activeTab === s.key ? "admin-nav__item--active" : ""}`}
            onClick={() => goToSection(s.path)}
          >
            {s.label}
            {s.key === "wishlist" && wishlist.length > 0 && (
              <span className="admin-nav__badge">{wishlist.length}</span>
            )}
          </button>
        ))}
      </nav>

      {activeTab === "orders" ? (
        <>
          {/* ── Stats Row ── */}
          <div className="admin-stats-row">
            <SparklineCard
              icon="📝"
              color="orange"
              title="Total Orders"
              value={orders.length}
              data={orderTrend}
            />
            <SparklineCard
              icon="⏳"
              color="blue"
              title="Pending Orders"
              value={pendingCount}
              data={orderTrend.map((v) => Math.max(0, v - 2))}
            />
            <SparklineCard
              icon="✅"
              color="green"
              title="Delivered Orders"
              value={orders.filter((o) => o.status === "delivered").length}
              data={orderTrend}
            />
            <SparklineCard
              icon="💵"
              color="amber"
              title="Revenue (7d)"
              value={formatPrice(
                orders
                  .filter((o) => o.status === "delivered")
                  .reduce((s, o) => s + (o.total || 0), 0),
              )}
              data={revenueTrend}
            />
          </div>

          {/* ── Recent Orders Widget ── */}
          {recentOrders.length > 0 && (
            <div className="admin-recent-orders">
              <h3 className="admin-recent-orders__title">Recent Orders</h3>
              <div className="admin-recent-orders__list">
                {recentOrders.map((order) => (
                  <div key={order.id} className="admin-recent-orders__item">
                    <div className="admin-recent-orders__info">
                      <span className="admin-recent-orders__id">
                        Order #{order.id}
                      </span>
                      <span className="admin-recent-orders__status admin-recent-orders__status--{order.status}">
                        {order.status}
                      </span>
                    </div>
                    <div className="admin-recent-orders__details">
                      <span className="admin-recent-orders__customer">
                        {order.customer?.fullName || "Unknown"}
                      </span>
                      <span className="admin-recent-orders__total">
                        {formatPrice(order.total)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Order Filters ── */}
          <div className="admin-order-filters">
            {["all", "pending", "confirmed", "delivered", "cancelled"].map((f) => (
              <button
                key={f}
                type="button"
                className={`admin-pill ${filter === f ? "admin-pill--active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === "pending" && pendingCount > 0 && (
                  <span className="admin-pill__count">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>

          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => setToast(null)}
            />
          )}

          {showConfirmDeleteAll && (
            <ConfirmDialog
              message={`Hide all ${terminalOrders.length} delivered/cancelled orders from dashboard? Orders will remain in customer history.`}
              onConfirm={handleDeleteAllHistory}
              onCancel={() => setShowConfirmDeleteAll(false)}
            />
          )}

          <div className="admin-bulk-actions">
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={selectedIds.size === 0}
              onClick={handleDeleteSelected}
            >
              Hide Selected ({selectedIds.size})
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={!hasTerminalOrders}
              onClick={() => setShowConfirmDeleteAll(true)}
            >
              Clear History ({terminalOrders.length})
            </button>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="empty-page">
              <p className="empty-state">
                {orders.length === 0
                  ? "No orders yet. Place an order from the customer app."
                  : "No orders match this filter."}
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <div className="admin-orders">
                {filteredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onUpdateStatus={async (id, status) => {
                      await updateOrderStatus(id, status);
                      setRecentOrders(prev => prev.map(o => String(o.id) === String(id) ? { ...o, status } : o));
                    }}
                    selected={selectedIds.has(order.dbId)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : activeTab === "productCategories" ? (
        <ProductCategoriesManager
          productCategories={productCategories}
          products={products}
          onAdd={addProductCategory}
          onEdit={editProductCategory}
          onDelete={deleteProductCategory}
          onNavigateToProducts={(categoryName) => {
            setProductFilter(categoryName);
            // Navigate to products tab
            navigate("/admin/products");
          }}
        />
      ) : activeTab === "discounts" ? (
        <DiscountManager products={products} onUpdateProduct={updateProduct} />
      ) : activeTab === "societies" ? (
        <SocietiesManager
          societies={societies}
          orders={orders}
          onAdd={addSociety}
          onEdit={editSociety}
          onDelete={deleteSociety}
        />
      ) : activeTab === "wishlist" ? (
        <>
          <div className="admin-stats-row">
            <SparklineCard
              icon="💖"
              color="indigo"
              title="Wishlist Items"
              value={wishlist.length}
              data={wishlistTrend}
            />
          </div>

          {wishlist.length === 0 ? (
            <div className="empty-page">
              <p className="empty-state">No items in wishlist yet.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <div className="product-grid">
                {wishlist.map((item) => (
                  <div
                    key={item.productId}
                    className="product-card admin-product-card"
                  >
                    <div className="product-card-top">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="product-card-image"
                        />
                      ) : (
                        <span className="product-card-emoji">{item.image}</span>
                      )}
                    </div>
                    <div className="product-card-body">
                      <h3 className="product-card-name">{item.name}</h3>
                      <p className="product-card-desc">{item.description}</p>
                      <p className="product-card-price">
                        {formatPrice(item.price)}
                      </p>
                      <span className="product-card-unit">/{item.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          {showProductForm ? (
            <AddItemPage
              product={editingProduct}
              onSave={editingProduct ? handleUpdateProduct : handleAddProduct}
              onCancel={() => {
                setShowProductForm(false);
                setEditingProduct(null);
              }}
              productCategories={productCategories}
            />
          ) : (
            <>
              {deleteProductTarget && (
                <ConfirmDialog
                  message="Delete this product? This action cannot be undone."
                  onConfirm={confirmDeleteProduct}
                  onCancel={() => setDeleteProductTarget(null)}
                />
              )}

              {editProductTarget && (
                <ConfirmDialog
                  message={`Edit "${editProductTarget.name}"?`}
                  onConfirm={confirmEditProduct}
                  onCancel={() => setEditProductTarget(null)}
                  danger={false}
                  confirmLabel="Edit"
                />
              )}

              <div className="admin-toolbar">
                <div className="admin-filters">
                  {productCategories.map((cat) => (
                    <button
                      key={cat.id}
                      className={`filter-btn ${productFilter === cat.name ? "filter-btn-active" : ""}`}
                      onClick={() => setProductFilter(cat.name)}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
                <button
                  className="btn btn-primary btn-icon-inline"
                  onClick={() => {
                    setEditingProduct(null);
                    setShowProductForm(true);
                  }}
                >
                  <IconPlus size={18} />
                  Add Product
                </button>
              </div>

              <div className="w-full overflow-x-auto">
                <div className="product-grid">
                  {filteredProducts.map((product) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onEdit={handleEditProduct}
                      onToggleStock={handleToggleStock}
                      onDeleteProduct={handleDeleteProduct}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {filteredProducts.length === 0 && !showProductForm && (
            <div className="empty-page">
              <p className="empty-state">No products found.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
