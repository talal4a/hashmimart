import { useMemo } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { ProductGridSkeleton, SkeletonBlock } from "../components/Skeleton";
import { useStore } from "../context/StoreContext";
import {
  getCategoryEmoji,
  getCategoryFamilyNames,
  getSubcategories,
} from "../lib/categories";

/* One category's page: its subcategories run along the top as a scrollable
   strip ("All" first), products fill the grid below. The selected
   subcategory lives in ?sub= so back/forward and shared links keep it. */
export default function CategoryPage() {
  const { categoryId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    shopProducts,
    productCategories,
    productsLoading,
    productCategoriesLoading,
  } = useStore();

  const category = productCategories.find((c) => c.id === categoryId);
  const subcategories = useMemo(
    () => getSubcategories(productCategories, categoryId),
    [productCategories, categoryId],
  );

  const inStock = useMemo(
    () => shopProducts.filter((p) => p.inStock),
    [shopProducts],
  );

  const familyProducts = useMemo(() => {
    const names = getCategoryFamilyNames(productCategories, categoryId);
    return inStock.filter((p) => names.has(p.productCategory));
  }, [inStock, productCategories, categoryId]);

  const subId = searchParams.get("sub");
  const selectedSub = subcategories.find((s) => s.id === subId) || null;

  const visibleProducts = selectedSub
    ? familyProducts.filter((p) => p.productCategory === selectedSub.name)
    : familyProducts;

  const countFor = (name) =>
    familyProducts.filter((p) => p.productCategory === name).length;

  const selectSub = (id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("sub", id);
    else next.delete("sub");
    setSearchParams(next, { replace: true });
  };

  if (!category) {
    if (productCategoriesLoading) {
      return (
        <div className="category-page">
          <SkeletonBlock style={{ height: 88, borderRadius: 16 }} />
          <ProductGridSkeleton count={4} />
        </div>
      );
    }
    return (
      <div className="empty-page">
        <p className="empty-state">This category isn't available.</p>
        <Link to="/products/retail" className="btn btn-secondary">
          Back to Retail
        </Link>
      </div>
    );
  }

  // A link straight to a subcategory opens its parent's page with that
  // subcategory already selected.
  if (category.parentId) {
    return (
      <Navigate to={`/category/${category.parentId}?sub=${category.id}`} replace />
    );
  }

  return (
    <div className="category-page">
      <header className="category-page-header">
        <span className="category-page-emoji" aria-hidden="true">
          {getCategoryEmoji(category, shopProducts)}
        </span>
        <div className="category-page-heading">
          <h1 className="category-page-title">{category.name}</h1>
          <p className="category-page-count">
            {familyProducts.length} item{familyProducts.length !== 1 ? "s" : ""}
          </p>
        </div>
      </header>

      {subcategories.length > 0 && (
        <nav className="subcategory-strip" aria-label={`${category.name} subcategories`}>
          <button
            type="button"
            className={`subcategory-chip ${!selectedSub ? "subcategory-chip--active" : ""}`}
            aria-pressed={!selectedSub}
            onClick={() => selectSub(null)}
          >
            <span className="subcategory-chip-emoji" aria-hidden="true">
              {getCategoryEmoji(category, shopProducts)}
            </span>
            <span className="subcategory-chip-name">All</span>
          </button>
          {subcategories.map((sub) => (
            <button
              key={sub.id}
              type="button"
              className={`subcategory-chip ${selectedSub?.id === sub.id ? "subcategory-chip--active" : ""}`}
              aria-pressed={selectedSub?.id === sub.id}
              onClick={() => selectSub(sub.id)}
            >
              <span className="subcategory-chip-emoji" aria-hidden="true">
                {getCategoryEmoji(sub, shopProducts)}
              </span>
              <span className="subcategory-chip-name">{sub.name}</span>
              <span className="subcategory-chip-count">{countFor(sub.name)}</span>
            </button>
          ))}
        </nav>
      )}

      <h2 className="section-title category-page-section">
        {selectedSub ? selectedSub.name : `All ${category.name}`}
      </h2>

      {visibleProducts.length > 0 ? (
        <div className="product-grid">
          {visibleProducts.map((product, i) => (
            <div
              key={product.id}
              className={`animate-slide-up stagger-${Math.min(i + 1, 8)}`}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      ) : productsLoading ? (
        <ProductGridSkeleton count={4} />
      ) : (
        <div className="empty-page">
          <p className="empty-state">
            No products in {selectedSub ? selectedSub.name : category.name} yet.
          </p>
          {selectedSub && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => selectSub(null)}
            >
              See all {category.name}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* Layout title for /category/:categoryId — the category's own name. */
// eslint-disable-next-line react-refresh/only-export-components
export function useCategoryTitle(categoryId) {
  const { productCategories } = useStore();
  const category = productCategories.find((c) => c.id === categoryId);
  return category?.name || "Category";
}
