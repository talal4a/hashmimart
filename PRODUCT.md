# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are household shoppers in Lahore buying groceries for their home. They shop frequently (daily/weekly), want groceries delivered fast, and value convenience. Secondary audiences: wholesale/business buyers served by the retail+wholesale product range, and the store's own staff (superadmin/ordermanager roles) who operate the admin dashboard.

## Product Purpose

Hashmi Mart is a grocery delivery app (PWA) that lets Lahore households shop retail or wholesale groceries and get them delivered fast. Success means an order placed in seconds, an order that arrives the same day, and a customer who comes back every week.

## Positioning

Voice & direct ordering is the differentiator: a customer can tell the app what they need (voice note or a quick direct order form) without browsing — a mechanism a neighboring grocery app could not truthfully copy. Premium fresh quality and fast delivery reinforce it.

## Operating Context

- Customers browse categories (Retail / Wholesale), search products, add to cart, and check out with delivery address + society selection.
- Direct Order flow: customer describes what they need without browsing; voice orders let them send a recorded note which staff listens to and fulfills.
- Order lifecycle: pending → confirmed → delivered / cancelled; customers track status, get notifications.
- Support: customers reach an AI support chat; staff handle chat and orders from the admin dashboard.
- Staff roles: superadmin (all sections), ordermanager (orders only). Admin sections: Orders, Products, Product Categories, Discounts, Societies, Wishlist.
- Currency is Pakistani Rupees (Rs.); locale formatting uses en-PK.

## Capabilities and Constraints

- React 19 + Vite + Supabase (auth, Postgres, storage, realtime); PWA with offline shell; deployable to the Play Store as a Trusted Web App (TWA) — standalone display, portrait orientation, assetlinks verification in place.
- Customer app: catalog, categories, product detail, cart, wishlist, checkout, order status, my orders, notifications, direct order, voice order, AI support chat, login/signup.
- Voice search + voice orders are implemented via upload + transcription helpers.
- Products may have images (uploaded), emoji fallbacks, units (per piece/kg), sale/discount pricing, in/out-of-stock toggles.
- Orders support customer cancellation while pending.
- Technical constraint: must remain installable as a Play Store PWA (manifest, icons, screenshots, offline navigation fallback already configured).

## Brand Commitments

- Name: Hashmi Mart (app id "Hashmi Mart", also referenced as "Hashmi Network" in page titles).
- Tagline: "Premium fresh groceries delivered fast in Lahore."
- Voice: warm and friendly — trusted neighborhood store tone.
- Primary theme color: cyan/teal (#06b6d4); clean white background, orange accent used for sale/discount states.

## Evidence on Hand

- Real seed catalog (retail + wholesale products) in `seed_data.sql` and `src/data/products.js`.
- Real order/chat/support data model in `supabase_complete_schema.sql`.
- PWA + TWA assets already generated (`public/` icons, manifest, assetlinks).
- No testimonials, press, or customer benchmarks exist in the repo — future work must not fabricate them.

## Product Principles

1. Speed to order — every flow should get a repeat customer from open to checkout in as few steps as possible.
2. Warmth over corporate polish — the interface and copy should feel like a trusted neighborhood store, not a faceless marketplace.
3. Voice & direct ordering first — the unique mechanism deserves prominence, not burial.
4. Clarity of order state — customers and staff must always know where an order stands.
5. Mobile-app quality everywhere — since it ships as a Play Store PWA, every screen must feel native-grade on a phone.

## Accessibility & Inclusion

- The app must honor `prefers-reduced-motion` and `prefers-color-scheme` (a ThemeContext with light/dark exists).
- PWA reachable on low-end Android devices — animations must stay cheap (transform/opacity) and layouts must not overflow small screens.
