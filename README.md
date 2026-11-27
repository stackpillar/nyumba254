# Nyumba254 — Kenya's Property Platform

A unified monorepo containing the Nyumba254 web application (Next.js 15) and mobile application (Expo/React Native) with shared business logic, UI components, and design system.

## Architecture

```
nyumba254/
├── apps/
│   ├── web/                 # Next.js 15 (App Router) on Vercel
│   └── mobile/              # Expo SDK 52+ (React Native) on EAS
├── packages/
│   ├── core/                # Business logic, types, Supabase client, hooks, utils
│   ├── ui/                  # Shared React components (web + RN via react-native-web)
│   ├── design-system/       # Design tokens (colors, spacing, typography), Tailwind config
│   └── config/              # Shared ESLint, TypeScript, Prettier, Tailwind configs
├── supabase/                # Database migrations & Edge Functions
└── turbo.json               # Turborepo pipeline config
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase account (for backend)
- Vercel account (for web deployment)
- Expo/EAS account (for mobile deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/stackpillar/nyumba254.git
cd nyumba254

# Install dependencies
pnpm install

# Copy environment files
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local

# Generate database types
pnpm db:types

# Start development servers
pnpm dev
```

This starts:
- Web app at `http://localhost:3000`
- Mobile app with Expo (scan QR code with Expo Go)

### Environment Variables

#### Web (`apps/web/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### Mobile (`apps/mobile/.env.local`)
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Development

### Common Commands

```bash
# Start all dev servers
pnpm dev

# Typecheck all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Run tests
pnpm test

# Build all packages
pnpm build

# Build web only
pnpm build:web

# Build mobile only
pnpm build:mobile

# Format code
pnpm format

# Generate Supabase types
pnpm db:types
```

### Working with Shared Packages

The monorepo uses pnpm workspaces. Shared packages are linked automatically:

- `@nyumba254/core` — Business logic, types, API, hooks
- `@nyumba254/ui` — React components (web + mobile)
- `@nyumba254/design-system` — Design tokens
- `@nyumba254/config/*` — Shared configs

To add a dependency to a shared package:

```bash
# Add to core package
pnpm --filter=core add zod

# Add to UI package
pnpm --filter=ui add lucide-react

# Add dev dependency to all
pnpm add -D -w typescript
```

## Project Structure Details

### `packages/core`
- **Types**: Generated from Supabase schema (`src/types/database.ts`)
- **Supabase Client**: Browser/Server/Service clients (`src/lib/supabase.ts`)
- **API Layer**: Typed wrappers for all RPCs/queries (`src/api/`)
- **React Hooks**: TanStack Query hooks for data fetching (`src/hooks/`)
- **Utilities**: Formatting, validation, URL builders (`src/utils/`)

### `packages/ui`
- **Primitives**: Button, Input, Card, Badge, Avatar, Select
- **Composites**: ListingCard, CategoryCard, SearchBox, NavBar, TabBar, Skeleton
- **Layout**: Container, Stack, Grid, Section, PageShell
- **Hooks**: Media queries, platform detection

### `packages/design-system`
- **Tokens**: Colors, spacing, typography, border-radius, shadows, animation
- **Utilities**: `cn()` (clsx), `cva()` (class-variance-authority)

### `apps/web`
- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS with design-system tokens
- **Auth**: @supabase/ssr with cookie-based sessions
- **State**: TanStack Query for server state
- **Deployment**: Vercel with middleware for auth

### `apps/mobile`
- **Framework**: Expo SDK 52+ with Expo Router v4
- **Styling**: NativeWind v4 (Tailwind for React Native)
- **Auth**: @supabase/supabase-js with AsyncStorage
- **State**: TanStack Query for server state
- **Navigation**: Expo Router with file-based routes
- **Deployment**: EAS Build/Submit

## Supabase Backend

The `supabase/` directory contains:
- **Migrations**: 26+ migration files in `supabase/migrations/`
- **Edge Functions**: 4 functions in `supabase/functions/`
  - `ai-listing-generate` — AI-powered listing generation (Elite feature)
  - `send-notification-email` — Transactional emails
  - `social-post` — Social media sharing
  - `tiktok-oauth-callback` — TikTok OAuth

Run migrations:
```bash
supabase db push
# or
pnpm db:migrate
```

Deploy functions:
```bash
pnpm functions:deploy
```

## CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`):

1. **Typecheck** — TypeScript compilation for all packages
2. **Lint** — ESLint with shared config
3. **Test** — Unit/integration tests
3. **Build Web** — Next.js production build
4. **Build Mobile** — EAS Preview builds
5. **DB Types** — Generate and check Supabase types
6. **Deploy Preview** — Vercel Preview (PRs) / Production (main)

### Required Secrets

Configure in GitHub repository settings:

```
TURBO_TOKEN
TURBO_TEAM
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ACCESS_TOKEN
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
EXPO_TOKEN
```

## Deployment

### Web (Vercel)

1. Connect repository to Vercel
2. Configure environment variables
3. Deploy — automatic on push to main

### Mobile (EAS)

```bash
# Development build
cd apps/mobile && eas build --profile development

# Preview build
cd apps/mobile && eas build --profile preview

# Production build
cd apps/mobile && eas build --profile production

# Submit to stores
cd apps/mobile && eas submit --profile production
```

## Key Features

- **Unified Codebase**: ~80% shared business logic, ~60% shared UI
- **Type Safety**: End-to-end TypeScript from database to components
- **Cross-Platform**: Single component library for web and mobile
- **Real-time**: Supabase Realtime for messages, viewings, notifications
- **Auth**: Magic links + OAuth (Google, Apple) with SSR sessions
- **PWA**: Web app installable with offline support
- **Deep Linking**: `nyumba254://` ↔ `https://nyumba254.com/`
- **Design System**: Consistent tokens, spacing, typography across platforms

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Run `pnpm typecheck && pnpm lint && pnpm test`
5. Submit a pull request

## License

MIT License — see LICENSE file for details.