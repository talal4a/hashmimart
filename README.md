# Hashmi Mart

Premium fresh groceries delivered fast in Lahore. A modern e-commerce application built with React, Vite, and Supabase.

## Features

- **Product Catalog**: Browse and search products by category
- **Shopping Cart & Wishlist**: Add items to cart and wishlist
- **Order Management**: Place orders and track delivery status
- **User Authentication**: Sign up, login, and password reset
- **Admin Dashboard**: Manage products, orders, and categories
- **Real-time Chat**: Admin-customer communication
- **AI Support**: Groq-powered AI assistant for customer support
- **Voice Search**: Voice-enabled product search
- **PWA Support**: Install as a mobile app
- **Responsive Design**: Optimized for mobile, tablet, and desktop

## Tech Stack

- **Frontend**: React 19, Vite 8
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Styling**: Custom CSS with responsive design
- **Icons**: Lucide React
- **Animations**: Lottie, Swiper
- **AI**: Groq API for support chat
- **Image Search**: Unsplash, Pixels, Pixabay APIs

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Supabase project (create at [supabase.com](https://supabase.com))
- (Optional) API keys for image search services

## Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd hashmi-network
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

**Required variables:**

- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key

**Optional variables:**

- `VITE_BASE_URL` - Base URL if deploying to subdirectory
- `VITE_UNSPLASH_API_KEY` - For admin image search
- `VITE_PIXELS_API_KEY` - For admin image search
- `VITE_PIXABAY_API_KEY` - For admin image search
- `GROQ_API_KEY` - For AI support chat
- `CRON_SECRET` - For scheduled tasks

### 4. Run development server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 5. Build for production

```bash
npm run build
```

The production files will be in the `dist` directory.

## Deployment

### Vercel

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Netlify

1. Push your code to GitHub
2. Import project in Netlify
3. Set build command: `npm run build`
4. Set publish directory: `dist`
5. Add environment variables
6. Deploy

### Other Platforms

Any static hosting service works:

- GitHub Pages
- Cloudflare Pages
- AWS S3 + CloudFront
- DigitalOcean App Platform

**Important**: Set the `VITE_BASE_URL` environment variable if deploying to a subdirectory (e.g., `https://example.com/hashmi-network`).

## Database Setup

The app uses Supabase for the database. Ensure you have the following tables:

- `products` - Product catalog
- `product_categories` - Product categories
- `shopping_modes` - Shopping modes (retail/wholesale)
- `orders` - Customer orders
- `order_items` - Order line items
- `profiles` - User profiles
- `wishlist_items` - Wishlist items
- `messages` - Chat messages
- `conversations` - Chat conversations
- `notifications` - Order notifications

Row Level Security (RLS) policies should be configured for proper access control.

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/     # Reusable components
├── context/       # React context providers
├── hooks/         # Custom React hooks
├── lib/           # Utility functions and API clients
├── pages/         # Page components
├── data/          # Static data
└── index.css      # Global styles
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT
