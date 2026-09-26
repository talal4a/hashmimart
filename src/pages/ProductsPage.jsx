import { useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { ProductGridSkeleton } from "../components/Skeleton";
import { useStore } from "../context/StoreContext";
import {
  getCategoryDisplayName,
  getCategoryDescription,
} from "../data/categoryStore";
import {
  getCategoryEmoji,
  getCategoryFamilyNames,
  getMainCategories,
  getSubcategories,
} from "../lib/categories";

export default function ProductsPage() {
  const { category } = useParams();
  const {
    shopProducts,
    productCategories,
    productsLoading,
    productCategoriesLoading,
  } = useStore();
  const [searchQuery, setSearchQuery] = useState("");

  const modeProducts = useMemo(
    () =>
      shopProducts.filter(
        (p) => p.inStock && (!category || p.category === category),
      ),
    [shopProducts, category],
  );

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return modeProducts;
    return modeProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        (product.description &&
          product.description.toLowerCase().includes(q)),
    );
  }, [modeProducts, searchQuery]);

  // One tile per main category; a subcategory's products count toward its
  // parent, since that's the page the tile opens.
  const categoryTiles = useMemo(
    () =>
      getMainCategories(productCategories).map((cat) => {
        const names = getCategoryFamilyNames(productCategories, cat.id);
        return {
          ...cat,
          emoji: getCategoryEmoji(cat, modeProducts),
          count: modeProducts.filter((p) => names.has(p.productCategory))
            .length,
          subCount: getSubcategories(productCategories, cat.id).length,
        };
      }),
    [productCategories, modeProducts],
  );

  const categoryDisplayName = category
    ? getCategoryDisplayName(category)
    : "All Products";
  const categoryDesc = category
    ? getCategoryDescription(category)
    : "Browse our complete collection";

  return (
    <div className="products-page">
      {/* Hero Section */}
      <div className="products-hero">
        <div className="products-hero-content">
          <h1 className="products-hero-title">{categoryDisplayName}</h1>
          <p className="products-hero-subtitle">{categoryDesc}</p>
          <div className="products-hero-search">
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
              placeholder="Search products..."
              className="products-hero-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Shop by Category — each tile opens that category's page */}
      {!searchQuery.trim() &&
        (categoryTiles.length > 0 || productCategoriesLoading) && (
          <section className="shop-categories" aria-labelledby="shop-cat-title">
            <h2 id="shop-cat-title" className="section-title">
              Shop by Category
            </h2>
            {categoryTiles.length === 0 ? (
              <div className="shop-category-grid" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="skeleton-block shop-category-tile--skeleton" />
                ))}
              </div>
            ) : (
              <div className="shop-category-grid">
                {categoryTiles.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/category/${cat.id}`}
                    className="shop-category-tile"
                  >
                    <span className="shop-category-emoji" aria-hidden="true">
                      {cat.emoji}
                    </span>
                    <span className="shop-category-name">{cat.name}</span>
                    <span className="shop-category-meta">
                      {cat.count} item{cat.count !== 1 ? "s" : ""}
                      {cat.subCount > 0 &&
                        ` · ${cat.subCount} type${cat.subCount !== 1 ? "s" : ""}`}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

      {/* All Products */}
      <div className="products-all">
        <h2 className="section-title">
          {searchQuery.trim() ? "Search Results" : "All Products"}
        </h2>
        <div className="product-grid">
          {filteredProducts.map((product, i) => (
            <div
              key={product.id}
              className={`animate-slide-up stagger-${Math.min(i + 1, 8)}`}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
        {productsLoading && filteredProducts.length === 0 && (
          <ProductGridSkeleton />
        )}
        {!productsLoading && filteredProducts.length === 0 && (
          <div className="empty-page">
            <div className="empty-state">
              {searchQuery.trim()
                ? `No products found matching "${searchQuery}"`
                : "No products here yet."}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function getProductsTitle(category) {
  if (!category) return "All Products";
  return `${getCategoryDisplayName(category)} Products`;
}
