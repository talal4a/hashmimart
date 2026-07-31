import { useRef, useState } from "react";
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
    image: "/slider/vegetables.png",
    cta: "Shop Vegetables",
    link: "/products/retail",
    accent: "#22c55e",
  },
  {
    id: 2,
    title: "Premium Fruits",
    subtitle: "Sweet and juicy fruits handpicked from local orchards",
    image: "/slider/fruits.png",
    cta: "Shop Fruits",
    link: "/products/retail",
    accent: "#ef4444",
  },
  {
    id: 3,
    title: "Dairy Essentials",
    subtitle: "Fresh milk, cheese, yogurt and more — delivered chilled",
    image: "/slider/dairy.png",
    cta: "Shop Dairy",
    link: "/products/retail",
    accent: "#3b82f6",
  },
  {
    id: 4,
    title: "Bakery Fresh",
    subtitle: "Artisan breads, croissants and pastries baked daily",
    image: "/slider/bakery.png",
    cta: "Shop Bakery",
    link: "/products/retail",
    accent: "#f59e0b",
  },
  {
    id: 5,
    title: "Meat & Poultry",
    subtitle: "Premium quality cuts — always fresh, never frozen",
    image: "/slider/meat.png",
    cta: "Shop Meat",
    link: "/products/retail",
    accent: "#dc2626",
  },
];

export default function HeroSlider() {
  const swiperRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

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
        onSlideChange={(swiper) => setActiveIndex(swiper.realIndex)}
        className="hero-slider"
      >
        {slides.map((slide, i) => (
          <SwiperSlide key={slide.id}>
            <div className="hero-slide-img">
              <img
                src={slide.image}
                alt={slide.title}
                loading={i === 0 ? "eager" : "lazy"}
                draggable="false"
              />
              <div className="hero-slide-overlay" />
              <div className="hero-slide-content">
                <span className="hero-slide-badge">Hashmi Mart</span>
                <h2 className="hero-slide-heading">{slide.title}</h2>
                <p className="hero-slide-desc">{slide.subtitle}</p>
                <Link to={slide.link} className="hero-slide-cta">
                  {slide.cta}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Slide counter */}
      <div className="hero-slide-counter">
        <span className="hero-slide-counter-current">
          {String(activeIndex + 1).padStart(2, "0")}
        </span>
        <span className="hero-slide-counter-sep">/</span>
        <span className="hero-slide-counter-total">
          {String(slides.length).padStart(2, "0")}
        </span>
      </div>
    </div>
  );
}
