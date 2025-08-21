# curate-news-feed

This is a client app for reading curated RSS feeds.

Just FYI, there is an authenticated section and better-auth connection -- it's not gonna work if you don't run the docker and configure some .env vars, but you shouldn't need any of it rn, it'll just be convenient when we do later.

Remember, this app follows RSS standards strictly, with types in `apps/server/src/schemas/feed.ts` as the source of truth. Everything else builds on top of this - the components in `apps/web/src/components/feed` are locked to these types, and the feed route makes typed RPC calls that return data matching this exact schema.

Read `LLM.txt` in the root for more context about the architecture, RSS philosophy, and technical details.

## Setup

1. `docker compose up -d` to get PostgreSQL running
2. `bun db:migrate` to set up the database schema
3. `bun dev` to start both web and server

## Architecture

- **Server**: Hono.js with tRPC for type-safe APIs, Better-Auth for authentication with NEAR Protocol accounts, Drizzle ORM on PostgreSQL
- **Web**: React with TanStack Router for routing, TanStack Query for data fetching, tRPC client for server communication
- **Data Flow**: Better-fetch pulls RSS feeds from `https://rss.curate.fun`, transforms them through Zod schemas, caches with BunCache
- **Database**: PostgreSQL with Docker Compose setup

## Available Scripts

- `bun dev` - Start both web and server in development
- `bun dev:web` - Start only the web application
- `bun dev:server` - Start only the server
- `bun build` - Build all applications
- `bun db:push` - Apply database schema changes
- `bun db:studio` - Open Drizzle Studio database UI
- `bun db:migrate` - Run database migrations

## Key Files

- `apps/server/src/schemas/feed.ts` - The RSS schema definitions that everything else builds on
- `apps/server/src/routers/index.ts` - tRPC endpoints for feeds, feed items, and health checks
- `apps/web/src/components/feed/index.tsx` - Main feed display component
- `apps/web/src/components/feed/item.tsx` - Individual feed item component
- `apps/server/src/index.ts` - Server setup with Hono, tRPC, and auth middleware
- `LLM.txt` - Detailed architecture and RSS philosophy documentation
