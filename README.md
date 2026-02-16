# PantryIQ Landing Page

Marketing landing page for PantryIQ - AI-powered restaurant forecasting software that minimizes food waste, optimizes inventory, and helps donate surplus food to those in need.

## 🚀 Tech Stack

- **Framework:** Next.js 16 (App Router, Server-Side Rendering)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS v4
- **UI Components:** shadcn/ui (New York style)
- **Icons:** Lucide React
- **Analytics:** PostHog
- **Runtime:** Node.js 20+

## ✨ Features

- 📧 **Email Waitlist** - API endpoint (`/api/subscribe`) forwards signups to backend
- 📊 **Analytics** - PostHog integration for user behavior tracking
- 🎨 **Dark/Light Mode** - Automatic theme switching based on system preferences
- 🎯 **Responsive Design** - Mobile-first approach with Tailwind CSS
- 🚀 **SEO Optimized** - Server-side rendering for better search visibility
- 🎨 **Custom Branding** - ChefHat favicon with adaptive colors for light/dark modes
- ⚡ **Performance** - Static page generation with Next.js optimization

## 📋 Prerequisites

- Node.js >= 24
- npm or yarn

## 🛠️ Installation

```bash
# Clone the repository
git clone <repository-url>
cd pantry-iq-landing

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the landing page.

## 📁 Project Structure

```
pantry-iq-landing/
├── app/
│   ├── api/
│   │   └── subscribe/
│   │       └── route.ts          # Email signup API endpoint
│   ├── layout.tsx                # Root layout with metadata
│   ├── page.tsx                  # Home page
│   ├── globals.css               # Global styles + Tailwind
│   └── sitemap.ts                # Sitemap generation
├── components/
│   ├── ui/                       # shadcn/ui components
│   └── landing-page.tsx          # Main landing page component
├── lib/
│   └── utils.ts                  # Utility functions
├── public/
│   ├── favicon/                  # Dark mode favicons
│   └── favicon-light/            # Light mode favicons
├── next.config.ts                # Next.js configuration
└── package.json
```

## 🔧 Available Scripts

```bash
# Development
npm run dev          # Start dev server at localhost:3000

# Production
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
```

## 🌐 API Endpoints

### POST `/api/subscribe`

Accepts email signups and forwards to backend service.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response:**

```json
{
  "message": "Successfully subscribed!"
}
```

Email data is forwarded to `https://harryt.dev/api/user` with `usesApps: ["pantryiq"]`.

## 📊 Analytics

PostHog is configured to track:

- `waitlist-form-submitted` - Successful email signups
- `waitlist-form-error` - Form submission errors
- `early-access-link-clicked` - CTA button clicks

PostHog proxying is configured via Next.js rewrites to `/ingest/*` and `/ph/*`.

## 🎨 Theming

The landing page automatically adapts to system dark/light mode preferences:

- CSS variables defined in `globals.css` with `@media (prefers-color-scheme: dark)`
- Favicons switch between light and dark variants
- Tailwind's `dark:` variants supported via custom variant configuration

## 🚢 Deployment

Configured for deployment on Fly.io:

```bash
# Build and deploy
npm run build
fly deploy
```

## 🔒 Environment Variables

No environment variables required for basic functionality. PostHog analytics are initialized client-side with public keys.

## 📝 Content Sections

The landing page includes:

1. **Hero** - Main value proposition with email signup
2. **Problem** - Food waste statistics ($162B annually)
3. **Features** - 6 AI capabilities (forecasting, inventory, menu intelligence, etc.)
4. **How It Works** - 3-step process
5. **Pricing** - $20/restaurant, $10/food truck (7-day free trial)
6. **Mission** - Charitable donation coordination
7. **Final CTA** - Secondary email signup

## 🤝 Contributing

This is a private repository for PantryIQ's marketing site. Contact the team for contribution guidelines.

## 📄 License

Proprietary - All rights reserved © 2026 PantryIQ
