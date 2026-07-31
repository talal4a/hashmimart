import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useImperativeHandle,
} from "react";
import React from "react";
import { Link } from "react-router-dom";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-fade";
import "swiper/css/pagination";

const slides = [
  {
    id: 1,
    title: "Fresh Vegetables",
    subtitle: "Farm-fresh vegetables delivered daily to your doorstep",
    image: "/slider/vegetables",
    cta: "Shop Vegetables",
    link: "/products/retail",
    accent: "#22c55e",
  },
  {
    id: 2,
    title: "Premium Fruits",
    subtitle: "Sweet and juicy fruits handpicked from local orchards",
    image: "/slider/fruits",
    cta: "Shop Fruits",
    link: "/products/retail",
    accent: "#ef4444",
  },
  {
    id: 3,
    title: "Dairy Essentials",
    subtitle: "Fresh milk, cheese, yogurt and more — delivered chilled",
    image: "/slider/dairy",
    cta: "Shop Dairy",
    link: "/products/retail",
    accent: "#3b82f6",
  },
  {
    id: 4,
    title: "Bakery Fresh",
    subtitle: "Artisan breads, croissants and pastries baked daily",
    image: "/slider/bakery",
    cta: "Shop Bakery",
    link: "/products/retail",
    accent: "#f59e0b",
  },
  {
    id: 5,
    title: "Meat & Poultry",
    subtitle: "Premium quality cuts — always fresh, never frozen",
    image: "/slider/meat",
    cta: "Shop Meat",
    link: "/products/retail",
    accent: "#dc2626",
  },
];

/* Slide counter lives in its own component so the 4s tick only re-renders
   these two <span>s, never the 5 slides above it. */
const SlideCounter = React.forwardRef(function SlideCounter(_props, ref) {
  const [index, setIndex] = useState(0);
  useImperativeHandle(ref, () => ({ set: setIndex }), []);

  return (
    <div className="hero-slide-counter">
      <span className="hero-slide-counter-current">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="hero-slide-counter-sep">/</span>
      <span className="hero-slide-counter-total">
        {String(slides.length).padStart(2, "0")}
      </span>
    </div>
  );
});

/* Memo the slide body, not the SwiperSlide itself: Swiper finds its slides by
   walking the React element tree for SwiperSlide, so those must stay inline. */
const SlideBody = React.memo(function SlideBody({ slide, i, ready }) {
  /* Fade mode stacks all 5 slides in the viewport, so loading="lazy" never
     defers anything. Hold the non-first images out of the DOM until the page
     is idle instead, so first load fetches and decodes one image, not five. */
  const showImage = i === 0 || ready;

  return (
    <div className="hero-slide-img">
      {showImage && (
        <picture>
          <source
            media="(max-width: 640px)"
            srcSet={`${slide.image}-640.webp`}
            sizes="100vw"
            type="image/webp"
          />
          <source
            srcSet={`${slide.image}.webp`}
            sizes="100vw"
            type="image/webp"
          />
          <img
            src={`${slide.image}.png`}
            alt={slide.title}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : "low"}
            /* Never "sync": that blocks the main thread on a ~4MB bitmap
               decode, which is what stalls scrolling on first load. */
            decoding="async"
            draggable="false"
            width="1600"
            height="340"
          />
        </picture>
      )}
      <div className="hero-slide-overlay" />
      <div className="hero-slide-content">
        <span className="hero-slide-badge">Hashmi Mart</span>
        <h2 className="hero-slide-heading">{slide.title}</h2>
        <p className="hero-slide-desc">{slide.subtitle}</p>
        <Link to={slide.link} className="hero-slide-cta">
          {slide.cta}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
});

function HeroSliderComponent() {
  const swiperRef = useRef(null);
  const counterRef = useRef(null);
  const inactivityTimerRef = useRef(null);

  /* Slides 2-5 mount once the browser is idle, keeping their fetches and
     decodes off the critical path that first-load scrolling competes with. */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const idle = window.requestIdleCallback;
    if (idle) {
      const handle = idle(() => setReady(true), { timeout: 2000 });
      return () => window.cancelIdleCallback?.(handle);
    }
    const t = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(t);
  }, []);

  const pauseAutoplay = useCallback(() => {
    if (swiperRef.current?.swiper?.autoplay) {
      swiperRef.current.swiper.autoplay.stop();
    }
  }, []);

  const resumeAutoplay = useCallback(() => {
    if (swiperRef.current?.swiper?.autoplay) {
      swiperRef.current.swiper.autoplay.start();
    }
  }, []);

  /* Push the new index straight into the counter's own state. The parent
     never re-renders, so the 5 slides and their <Link>s stay untouched. */
  const handleSlideChange = useCallback((swiper) => {
    counterRef.current?.set(swiper.realIndex);
  }, []);

  const handleUserInteraction = useCallback(() => {
    pauseAutoplay();
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      resumeAutoplay();
    }, 3000);
  }, [pauseAutoplay, resumeAutoplay]);

  useEffect(() => {
    const handleTouchStart = () => handleUserInteraction();
    const handlePointerDown = () => handleUserInteraction();
    const handleWheel = () => handleUserInteraction();

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });
    window.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("wheel", handleWheel);
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [handleUserInteraction]);

  return (
    <div className="hero-slider-wrap">
      <Swiper
        ref={swiperRef}
        modules={[Autoplay, EffectFade, Pagination]}
        effect="fade"
        speed={800}
        autoplay={{
          delay: 4000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        pagination={{
          clickable: true,
          dynamicBullets: true,
        }}
        loop
        onSlideChange={handleSlideChange}
        className="hero-slider"
      >
        {slides.map((slide, i) => (
          <SwiperSlide key={slide.id}>
            <SlideBody slide={slide} i={i} ready={ready} />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Slide counter — isolated, so the tick does not re-render slides */}
      <SlideCounter ref={counterRef} />
    </div>
  );
}

export default React.memo(HeroSliderComponent);
