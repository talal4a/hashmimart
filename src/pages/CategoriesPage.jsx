import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  IconPackage,
  IconStore,
  IconDelivery,
  IconBestPrice,
  IconDirectOrder,
  IconCategories,
  IconSecure,
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
import Typewriter from "../components/Typewriter";

/* Typewriter cycles through these phrases under the hero badge. Kept short so
   each fits on one line even on a 320px phone — no wrap, no layout jumps. */
const HERO_TITLE_PHRASES = [
  "Welcome to Hashmi Mart",
  "Premium Groceries",
  "Fresh & Fast Delivery",
];

/* Marquee strip below the hero slider — decorative only (aria-hidden). The
   track renders the same group twice and translates -50%, so the loop is
   seamless. transform-only = GPU-composited on low-end phones. Deliberately
   NOT in the offscreen-pause observer: it runs infinitely and only stops on
   hover (or under prefers-reduced-motion). */
const MARQUEE_ITEMS = [
  ["🚚", "Fast Delivery"],
  ["🥬", "Fresh Produce"],
  ["💰", "Best Prices"],
  ["🛡️", "Quality First"],
  ["⚡", "Same-Day Dispatch"],
  ["🏆", "Trusted in Lahore"],
];

/* One-time first-run spotlight flag — armed by signup (see AuthContext.signUp)
   and consumed the moment the spotlight is dismissed, so it only ever shows
   once per browser, right after a brand-new account's first visit. */
const SPOTLIGHT_KEY = "hashmi-direct-order-spotlight";

function MarqueeItem({ icon, label }) {
  return (
    <span className="marquee-item">
      <span className="marquee-item-icon" aria-hidden="true">
        {icon}
      </span>
      <span>{label}</span>
    </span>
  );
}

/* Infinite marquee.
   - Desktop: two copies of the set + a pure-CSS -50% loop — seamless and it
     fills wide screens (that's the duplicate you asked to keep there).
   - Mobile: ONE copy driven by a requestAnimationFrame wrap loop. Each item
     rotates to the back the moment it's fully off-screen, so the strip runs
     continuously with each item appearing once per cycle — no stop, no jump,
     no repeated text on the small screen. */
function Marquee() {
  const trackRef = useRef(null);
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.matchMedia?.("(max-width: 700px)").matches),
  );

  useEffect(() => {
    const mq = window.matchMedia?.("(max-width: 700px)");
    if (!mq) return undefined;
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    if (!isMobile) return undefined; // desktop uses the CSS loop
    const track = trackRef.current;
    if (!track) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return undefined; // static strip for reduced-motion users
    }

    const speed = 60; // px per second
    let offset = 0;
    let last = null;
    let raf = null;
    let paused = false;

    // Measure the fixed right margin ONCE (getComputedStyle can force a style
    // recalc, so we never call it per-frame). The width is still read per
    // frame from the live layout.
    const firstEl = track.firstElementChild;
    const itemMargin = firstEl
      ? parseFloat(getComputedStyle(firstEl).marginRight) || 0
      : 0;

    const step = (time) => {
      if (!paused) {
        if (last == null) last = time;
        const dt = Math.min((time - last) / 1000, 0.1); // clamp tab-switch gaps
        last = time;
        offset -= speed * dt;

        // Once the first item is fully off-screen left, move it to the end
        // and compensate by its full advance (width + right margin) — an
        // item's getBoundingClientRect().width excludes the margin, so
        // compensating by width alone made the strip jump left every wrap.
        const first = track.firstElementChild;
        if (first) {
          const advance = first.getBoundingClientRect().width + itemMargin;
          if (offset <= -advance) {
            offset += advance;
            track.appendChild(first);
          }
        }
        track.style.transform = `translateX(${offset}px)`;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    // Pause on hover only on real mouse devices (a fine pointer + hover). On
    // touch screens the mouseenter/mouseleave pair fires on tap and would
    // leave the strip stuck paused — the "stops and starts again" feeling on
    // a phone. (pointer: fine) also excludes hybrid touchscreen laptops,
    // where hover reports true but a tap would still trigger mouseenter.
    if (window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) {
      const pause = () => {
        paused = true;
      };
      const resume = () => {
        paused = false;
        last = null;
      };
      track.addEventListener("mouseenter", pause);
      track.addEventListener("mouseleave", resume);
      return () => {
        cancelAnimationFrame(raf);
        track.removeEventListener("mouseenter", pause);
        track.removeEventListener("mouseleave", resume);
      };
    }

    return () => cancelAnimationFrame(raf);
  }, [isMobile]);

  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track" ref={trackRef}>
        {MARQUEE_ITEMS.map(([icon, label]) => (
          <MarqueeItem key={label} icon={icon} label={label} />
        ))}
        {/* Second copy only on desktop — keeps the CSS loop full on wide screens */}
        {!isMobile &&
          MARQUEE_ITEMS.map(([icon, label]) => (
            <MarqueeItem key={`${label}-2`} icon={icon} label={label} />
          ))}
      </div>
    </div>
  );
}

function CategoryIcon({ name }) {
  if (name === "retail") return <IconStore />;
  if (name === "wholesale") return <IconPackage />;
  return <IconCategories />;
}

/* Each category card icon gets a subtle looping animation class — same
   lightweight recipe as the feature pills (transform-only, small amplitude). */
function categoryIconClass(name) {
  if (name === "retail") return "cat-icon-store";
  if (name === "wholesale") return "cat-icon-package";
  return "cat-icon-categories";
}

export default function CategoriesPage() {
  const { isAuthenticated, isStaff } = useAuth();
  const { categories, orders, products } = useStore();
  const [orderFilter, setOrderFilter] = useState("all");
  const heroRef = useRef(null);
  const gridRef = useRef(null);
  const directOrderRef = useRef(null);
  const gotItRef = useRef(null);
  const navigate = useNavigate();
  const [spotlightOpen, setSpotlightOpen] = useState(false);
  const [spotlight, setSpotlight] = useState(null); // card rect once measured

  /* Pause the looping icons when their section scrolls out of view or the tab
     is hidden — the loops are decorative, so on low-end phones we never pay
     for them when nobody can see them. Both the hero content (feature pills +
     badge) and the category grid (store/package/grid/direct icons) pause.

     Each IntersectionObserver callback only lists the elements whose state
     actually changed, so we keep a per-element map of last-known visibility:
     otherwise, when one container scrolls out while another is still on
     screen, "anyVisible" would wrongly become false and freeze icons that
     are visible (the bug you saw on mobile). */
  useEffect(() => {
    const els = [heroRef.current, gridRef.current].filter(Boolean);
    if (els.length === 0) return;

    const pause = () =>
      els.forEach((el) => el.classList.add("icons-paused"));
    const resume = () =>
      els.forEach((el) => el.classList.remove("icons-paused"));

    // Assume visible until the observer tells us otherwise.
    const visible = new Map(els.map((el) => [el, true]));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => visible.set(e.target, e.isIntersecting));
        // Resume while ANY container is on screen; pause only when ALL are out.
        const anyVisible = [...visible.values()].some(Boolean);
        anyVisible ? resume() : pause();
      },
      { threshold: 0.05 },
    );
    els.forEach((el) => io.observe(el));

    const onVisibility = () => (document.hidden ? pause() : resume());
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* First-run spotlight: when a freshly signed-up customer lands here, wait
     for the entrance animations to settle, then dim the page around the
     Direct Order card with a tooltip pointing at it. Staff/admin never see
     it — it's a shopper onboarding cue. */
  useEffect(() => {
    // TEMP-TEST: ?spotlight=1 previews the overlay without auth — REMOVE ME
    const demo = new URLSearchParams(window.location.search).get("spotlight") === "1";
    if ((!isAuthenticated || isStaff) && !demo) return undefined;
    let armed = demo;
    if (!demo) {
      try {
        armed = localStorage.getItem(SPOTLIGHT_KEY) === "1";
      } catch {
        /* storage unavailable — skip */
      }
    }
    if (!armed) return undefined;
    const t = setTimeout(() => setSpotlightOpen(true), 800);
    return () => clearTimeout(t);
  }, [isAuthenticated, isStaff]);

  const dismissSpotlight = useCallback(
    (goToDirectOrder = false) => {
      setSpotlightOpen(false);
      setSpotlight(null);
      try {
        localStorage.removeItem(SPOTLIGHT_KEY);
      } catch {
        /* ignore */
      }
      if (goToDirectOrder) navigate("/direct-order");
    },
    [navigate],
  );

  /* While the spotlight is open: lock body scroll and smoothly bring the
     card to the vertical center, then wait for everything (the smooth scroll
     AND the scroll-reveal transition) to settle before measuring its exact
     rect — so the hole and tooltip pop in sitting directly ON the card.
     Re-measured on resize/orientation change so the hole never drifts off.
     The overlay itself is rendered through a portal to document.body: the
     page wrapper keeps a fill-mode transform (translateY(0)) after its page
     transition, and any non-none transform on an ancestor makes position
     fixed anchor to that ancestor instead of the viewport — which is exactly
     why the tooltip used to land offset from the card. */
  useEffect(() => {
    if (!spotlightOpen) return undefined;
    const card = directOrderRef.current;
    if (!card) return undefined;

    const prevOverflow = document.body.style.overflow;

    /* Put the card at ~38% of the viewport height: roughly centered but with
       room for the tooltip above it. window.scrollTo clamps gracefully if the
       card sits near the very end of the page. (scrollIntoView + a locked
       body can fight; this explicit target + settling loop is deterministic.) */
    const targetY =
      card.getBoundingClientRect().top +
      window.scrollY -
      window.innerHeight * 0.38;
    window.scrollTo({ top: Math.max(targetY, 0), behavior: "smooth" });

    let raf = null;
    let settleRaf = null;
    let focusTimer = null;
    let lockTimer = null;
    const settleStart = performance.now();
    let lastTop = null;
    let lastLeft = null;
    let stableFrames = 0;

    const lockScroll = () => {
      document.body.style.overflow = "hidden";
    };

    const measure = () => {
      const r = card.getBoundingClientRect();
      setSpotlight({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
        tooltipAbove: r.top > 210, // room for the bubble + arrow
        viewportH: window.innerHeight,
      });
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => gotItRef.current?.focus(), 80);
    };

    /* Keep watching while the card is still moving (smooth scroll and the
       reveal transition); once it has stopped for a few frames, lock the
       page and place the hole + tooltip exactly on it. Hard cap so a stuck
       animation can never leave the spotlight hole-less. */
    const settle = () => {
      const r = card.getBoundingClientRect();
      const moved =
        lastTop !== null &&
        (Math.abs(r.top - lastTop) > 0.5 || Math.abs(r.left - lastLeft) > 0.5);
      lastTop = r.top;
      lastLeft = r.left;
      if (moved) stableFrames = 0;
      else stableFrames += 1;

      const elapsed = performance.now() - settleStart;
      if ((stableFrames >= 4 && elapsed > 250) || elapsed > 2000) {
        lockScroll();
        measure();
        return;
      }
      settleRaf = requestAnimationFrame(settle);
    };

    raf = requestAnimationFrame(settle);
    // Safety: even if the loop stalls, don't leave the page scrollable behind
    // the spotlight.
    lockTimer = setTimeout(lockScroll, 2200);

    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    const onKey = (e) => {
      if (e.key === "Escape") dismissSpotlight(false);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prevOverflow;
      if (raf) cancelAnimationFrame(raf);
      if (settleRaf) cancelAnimationFrame(settleRaf);
      clearTimeout(focusTimer);
      clearTimeout(lockTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [spotlightOpen, dismissSpotlight]);

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

      {/* Theme-matched marquee — below the hero slider, seamless loop */}
      <Marquee />

      <section className="hero-section">
        <div ref={heroRef} className="hero-content animate-slide-up">
          <div className="hero-badge">
            <span className="hero-badge-float">🚀</span>
            <span>Premium Quality</span>
          </div>
          <h1 className="hero-title" aria-label={HERO_TITLE_PHRASES[0]}>
            <Typewriter phrases={HERO_TITLE_PHRASES} />
          </h1>
          <p className="hero-subtitle">
            Premium fresh groceries delivered fast in Lahore. Shop retail or
            wholesale today!
          </p>            <div className="hero-features">
            <div className="hero-feature animate-slide-up stagger-1">
              <div className="hero-feature-icon feature-icon-truck">
                <IconDelivery size={32} />
                <span className="truck-road" aria-hidden="true" />
              </div>
              <div>
                <h3>Fast Delivery</h3>
                <p>Same-day delivery available</p>
              </div>
            </div>
            <div className="hero-feature animate-slide-up stagger-2">
              <div className="hero-feature-icon feature-icon-shield">
                <IconSecure size={32} />
              </div>
              <div>
                <h3>Fresh Produce</h3>
                <p>Daily fresh from local farms</p>
              </div>
            </div>
            <div className="hero-feature animate-slide-up stagger-3">
              <div className="hero-feature-icon feature-icon-tilt">
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
        <div ref={gridRef} className="category-grid">
          {categories.map((cat, i) => {
            const badge = getCategoryBadge(cat.name);
            return (
              <Link
                key={cat.id}
                to={`/products/${cat.name}`}
                className={`category-card animate-slide-up stagger-${(i % 8) + 1}`}
              >
                <div className={`category-card-icon ${categoryIconClass(cat.name)}`}>
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
            <div className="category-card-icon cat-icon-categories">
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
            ref={directOrderRef}
            to={
              isAuthenticated && !isStaff
                ? "/direct-order"
                : "/login?redirect=%2Fdirect-order"
            }
            className={`category-card animate-slide-up stagger-${((categories.length + 1) % 8) + 1}`}
          >
            <div className="category-card-icon cat-icon-direct">
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
              <h2>Your Orders</h2>
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

      {/* First-run spotlight — dims the page, illuminates the Direct Order
          card, tooltip points at it. Tap the card to open Direct Order, tap
          anywhere else (or Got it / Esc) to dismiss. Rendered through a
          portal to document.body so position:fixed anchors to the real
          viewport (the page-wrapper's fill-mode transform would otherwise
          shift the hole + tooltip off the card). */}
      {spotlightOpen &&
        createPortal(
          <div
            className="spotlight-overlay"
            onClick={() => dismissSpotlight(false)}
          >
            {spotlight && (
              <>
                <div
                  className="spotlight-hole"
                  style={{
                    left: spotlight.left,
                    top: spotlight.top,
                    width: spotlight.width,
                    height: spotlight.height,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissSpotlight(true);
                  }}
                  role="button"
                  aria-label="Open Direct Order"
                  tabIndex={-1}
                />
                <div
                  className={`spotlight-tooltip${spotlight.tooltipAbove ? "" : " spotlight-tooltip--below"}`}
                  style={
                    spotlight.tooltipAbove
                      ? {
                          left: spotlight.left + spotlight.width / 2,
                          bottom: spotlight.viewportH - spotlight.top + 16,
                        }
                      : {
                          left: spotlight.left + spotlight.width / 2,
                          top: spotlight.top + spotlight.height + 16,
                        }
                  }
                  role="dialog"
                  aria-modal="true"
                  aria-label="Welcome tip about Direct Order"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="spotlight-tooltip-emoji" aria-hidden="true">
                    ⚡
                  </span>
                  <div className="spotlight-tooltip-body">
                    <p className="spotlight-tooltip-title">New here?</p>
                    <p className="spotlight-tooltip-text">
                      Place your order instantly without browsing.
                    </p>
                  </div>
                  <button
                    ref={gotItRef}
                    type="button"
                    className="spotlight-tooltip-btn"
                    onClick={() => dismissSpotlight(false)}
                  >
                    Got it
                  </button>
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
