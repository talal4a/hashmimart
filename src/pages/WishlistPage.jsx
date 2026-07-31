import { Link } from "react-router-dom";
import { formatPrice } from "../data/products";
import { useStore } from "../context/StoreContext";
import { IconHeart } from "../components/Icons";

export default function WishlistPage() {
  const { wishlist, toggleWishlist, addToCart, getProductById } = useStore();

  if (wishlist.length === 0) {
    return (
      <div className="empty-page">
        <IconHeart size={48} />
        <p className="empty-state">Your wishlist is empty</p>
        <Link to="/" className="btn btn-secondary">
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="wishlist-page">
      <ul className="wishlist-list">
        {wishlist.map((item) => {
          const product = getProductById(item.productId);
          const defaultQty =
            product?.category === "wholesale"
              ? (product.wholesaleOptions?.[0] ?? 1)
              : 1;

          return (
            <li key={item.productId} className="wishlist-item">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="wishlist-item-image"
                  loading="lazy"
                />
              ) : (
                <div className="wishlist-item-emoji" aria-hidden="true">
                  {item.image}
                </div>
              )}
              <div className="wishlist-item-info">
                <h3>{item.name}</h3>
                {item.salePrice != null && item.salePrice < item.price ? (
                  <p>
                    <span className="product-card-sale">
                      {formatPrice(item.salePrice)}
                    </span>
                    <span className="product-card-original">
                      {formatPrice(item.price)}
                    </span>
                    <span> / {item.unit}</span>
                  </p>
                ) : (
                  <p>
                    {formatPrice(item.price)} / {item.unit}
                  </p>
                )}
              </div>
              <div className="wishlist-item-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => product && addToCart(product, defaultQty)}
                >
                  Add to Cart
                </button>
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  onClick={() => product && toggleWishlist(product)}
                  aria-label="Remove from wishlist"
                >
                  <IconHeart filled size={20} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
