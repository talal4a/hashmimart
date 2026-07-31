import { useState } from "react";
import { Link } from "react-router-dom";
import { formatPrice } from "../data/products";
import { useStore } from "../context/StoreContext";
import QuantityControl from "./QuantityControl";
import { IconHeart } from "./Icons";

export default function ProductCard({ product }) {
  const { addToCart, toggleWishlist, isInWishlist } = useStore();
  const productId = product.productId || product.id;
  const isWholesale = product.category === "wholesale";
  const defaultQty = isWholesale ? (product.wholesaleOptions?.[0] ?? 1) : 1;
  const [quantity, setQuantity] = useState(defaultQty);
  const [imgError, setImgError] = useState(false);
  const wished = isInWishlist(productId);

  const handleAdd = (e) => {
    e.stopPropagation();
    addToCart(product, quantity);
  };

  const handleWishlistToggle = (e) => {
    e.stopPropagation();
    toggleWishlist(product);
  };

  const showPlaceholder = !product.imageUrl || imgError;
  const hasDiscount =
    product.salePrice != null && product.salePrice < product.price;
  const discountPercentage = hasDiscount
    ? Math.round(((product.price - product.salePrice) / product.price) * 100)
    : 0;

  return (
    <article className="product-card">
      <div className="product-card-top">
        <Link to={`/product/${productId}`} className="link-reset">
          {showPlaceholder ? (
            <div className="product-card-placeholder">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21,15 16,10 5,21" />
              </svg>
              <span className="product-card-emoji">{product.image}</span>
            </div>
          ) : (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="product-card-image"
              loading="lazy"
              onError={() => setImgError(true)}
            />
          )}
        </Link>
        {hasDiscount && (
          <span className="discount-chip">{discountPercentage}% OFF</span>
        )}
        <button
          type="button"
          className={`wishlist-btn ${wished ? "wishlist-btn-active" : ""}`}
          onClick={handleWishlistToggle}
          aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
        >
          <IconHeart filled={wished} size={20} />
        </button>
      </div>

      <Link to={`/product/${productId}`} className="link-reset">
        <div className="product-card-body">
          <h3 className="product-card-name">{product.name}</h3>
          <p className="product-card-desc">{product.description}</p>
          <div className="product-card-price">
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
              <span className="product-card-regular">
                {formatPrice(product.price)}
              </span>
            )}
            <span className="product-card-unit"> / {product.unit}</span>
          </div>
        </div>
      </Link>

      <div className="product-card-actions">
        <div className="product-card-controls">
          {isWholesale && product.wholesaleOptions ? (
            <select
              className="wholesale-select"
              value={quantity}
              onChange={(e) => {
                setQuantity(Number(e.target.value));
              }}
            >
              {product.wholesaleOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt} {product.unit}
                </option>
              ))}
            </select>
          ) : (
            <QuantityControl
              value={quantity}
              onChange={(q) => setQuantity(q)}
              size="sm"
            />
          )}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block product-card-add-btn"
          onClick={handleAdd}
        >
          Add to Cart
        </button>
      </div>
    </article>
  );
}
