import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { ProductGridSkeleton } from "../components/Skeleton";
import { useStore } from "../context/StoreContext";
import {
  getCategoryDisplayName,
  getCategoryDescription,
} from "../data/categoryStore";

export default function ProductsPage() {
  const { category } = useParams();
  const { products, productCategories, productsLoading } = useStore();
  const [selectedProductCategory, setSelectedProductCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (!product.inStock) return false;
      const matchesMode = !category || product.category === category;
      const matchesProductCategory =
        selectedProductCategory === "all" ||
        product.productCategory === selectedProductCategory;
      const matchesSearch =
        searchQuery === "" ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.description &&
          product.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()));
      return matchesMode && matchesProductCategory && matchesSearch;
    });
  }, [products, category, selectedProductCategory, searchQuery]);

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

      {/* Category Filters */}
      <div className="products-categories">
        <h2 className="section-title">Browse by Category</h2>
        <div className="admin-filters">
          <button
            className={`filter-btn ${selectedProductCategory === "all" ? "filter-btn-active" : ""}`}
            onClick={() => setSelectedProductCategory("all")}
          >
            All
          </button>
          {productCategories.map((cat) => (
            <button
              key={cat.id}
              className={`filter-btn ${selectedProductCategory === cat.name ? "filter-btn-active" : ""}`}
              onClick={() => setSelectedProductCategory(cat.name)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* All Products */}
      <div className="products-all">
        <h2 className="section-title">All Products</h2>
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
              No products found matching "{searchQuery}"
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
