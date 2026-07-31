// Lightweight skeleton primitives for data-dependent screens. Each block
// shimmers via the shared `skeleton-block` animation and uses design tokens so
// it adapts to light/dark automatically. Compose these into per-screen
// placeholders that mirror the real content's layout.

export function SkeletonBlock({ className = '', style }) {
  return <div className={`skeleton-block ${className}`} style={style} aria-hidden="true" />
}

// Product grid placeholder — mirrors ProductCard's shape (image + two lines).
export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-block skeleton-card__media" />
          <div className="skeleton-card__body">
            <div className="skeleton-block skeleton-line--long" />
            <div className="skeleton-block skeleton-line--short" />
            <div className="skeleton-block skeleton-card__cta" />
          </div>
        </div>
      ))}
    </div>
  )
}

// Vertical list placeholder — for orders / notifications rows.
export function ListSkeleton({ count = 5 }) {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-row">
          <div className="skeleton-block skeleton-line--long" />
          <div className="skeleton-block skeleton-line--short" />
        </div>
      ))}
    </div>
  )
}
