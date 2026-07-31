import { useState } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "../context/StoreContext";
import { formatPrice } from "../data/products";
import { IconHeart, IconPlus, IconMinus } from "../components/Icons";
import ProductCard from "../components/ProductCard";

export default function ProductDetailPage() {
  const { productId } = useParams();
  const { getProductById, addToCart, toggleWishlist, isInWishlist, products } =
    useStore();
  const [quantity, setQuantity] = useState(1);
  const [selectedWholesaleQty, setSelectedWholesaleQty] = useState(null);

  const product = getProductById(productId);

  if (!product) {
    return (
      <div className="empty-page">
        <p className="empty-state">Product not found.</p>
      </div>
    );
  }

  const inWishlist = isInWishlist(product.id);

  const handleAddToCart = () => {
    addToCart(product, quantity);
  };

  const hasDiscount =
    product.salePrice != null && product.salePrice < product.price;

  const priceFor = (base) => {
    if (product.category === "wholesale" && selectedWholesaleQty) {
      return base * selectedWholesaleQty;
    }
    return base;
  };

  const getCurrentPrice = () => priceFor(product.salePrice ?? product.price);
  const getOriginalPrice = () => priceFor(product.price);

  // Get related products from same category
  const relatedProducts = products
    .filter(
      (p) =>
        p.id !== product.id &&
        p.productCategory === product.productCategory &&
        p.inStock,
    )
    .slice(0, 4);

  return (
    <div className="product-detail-page-new">
      <div className="product-detail-container-new">
        <div className="product-detail-image-new">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} />
          ) : (
            <div className="product-detail-placeholder-new">
              <svg
                width="64"
                height="64"
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
              <div className="product-detail-emoji-new">{product.image}</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => toggleWishlist(product)}
            className={`wishlist-toggle-new ${inWishlist ? "wishlist-toggle-active-new" : ""}`}
            aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
          >
            <IconHeart size={24} />
          </button>
        </div>

        <div className="product-detail-info-new">
          <div className="product-detail-badges">
            {product.category === "wholesale" && (
              <span className="product-badge product-badge-wholesale">
                Wholesale
              </span>
            )}
            {!product.inStock && (
              <span className="product-badge product-badge-out">
                Out of Stock
              </span>
            )}
            {product.productCategory && (
              <span className="product-badge product-badge-category">
                {product.productCategory}
              </span>
            )}
          </div>

          <h1 className="product-detail-name-new">{product.name}</h1>

          <div className="product-detail-price-new">
            <span className="price-value-new">
              {formatPrice(getCurrentPrice())}
            </span>
            {hasDiscount && (
              <span className="price-original-new">
                {formatPrice(getOriginalPrice())}
              </span>
            )}
            {product.category === "wholesale" && selectedWholesaleQty && (
              <span className="price-unit-new">
                /{selectedWholesaleQty} {product.unit}
              </span>
            )}
            {product.category === "retail" && (
              <span className="price-unit-new">/{product.unit}</span>
            )}
          </div>

          {product.description && (
            <p className="product-detail-description-new">
              {product.description}
            </p>
          )}

          {product.category === "wholesale" && product.wholesaleOptions && (
            <div className="product-detail-wholesale-new">
              <h3 className="product-section-title">Choose Quantity</h3>
              <div className="wholesale-options-new">
                {product.wholesaleOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`wholesale-option-new ${selectedWholesaleQty === option ? "wholesale-option-selected-new" : ""}`}
                    onClick={() => setSelectedWholesaleQty(option)}
                  >
                    {option} {product.unit}
                  </button>
                ))}
              </div>
            </div>
          )}

          {product.category === "retail" && (
            <div className="product-detail-quantity-new">
              <h3 className="product-section-title">Quantity</h3>
              <div className="quantity-selector-new">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="quantity-btn-new"
                >
                  <IconMinus size={20} />
                </button>
                <span className="quantity-value-new">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="quantity-btn-new"
                >
                  <IconPlus size={20} />
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleAddToCart}
            className="product-add-btn-new"
            disabled={!product.inStock}
          >
            {!product.inStock ? "Out of Stock" : "Add to Cart"}
          </button>
        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="related-products-section">
          <h2 className="related-products-title">Related Products</h2>
          <div className="related-products-grid">
            {relatedProducts.map((relatedProduct) => (
              <ProductCard key={relatedProduct.id} product={relatedProduct} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
