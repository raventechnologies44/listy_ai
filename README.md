# ListyAI — AI-powered real estate marketing and management

ListyAI is a React + Vite real-estate SaaS workspace with Supabase authentication/database/storage, Claude-powered AI, lead management, scheduling, analytics and WhatsApp Business integration.

## Quick start

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
# Edit .env.local with your Supabase and server-side AI/Meta values.
npm run dev
```

Open `http://localhost:5173`.

## Supabase setup

Run the migrations in `supabase/migrations/` in order. Migration `006_subscription_plans.sql` adds account plan entitlements and database-level active listing protection without deleting existing data.

Storage setup is documented in `supabase/STORAGE_SETUP.md`.

## Claude

ListyAI keeps Claude/Anthropic as its AI provider. The current code uses `claude-sonnet-4-6` by default; keep the model configurable through `ANTHROPIC_MODEL`. Anthropic currently lists Claude Sonnet 4.6 as an active API model.

## WhatsApp Business

The authenticated user flow uses Meta Embedded Signup. Technical identifiers and access tokens stay on the server. The webhook endpoint is:

`/api/whatsapp/webhook`

Required Meta/Supabase server configuration is documented in `.env.example` and the existing WhatsApp API routes.

## Plans

- **Starter — US$15/month:** individual agent workflow with core AI marketing, leads, follow-ups, scheduling and basic analytics.
- **Professional — US$25/month:** full AI marketing, WhatsApp Business, AI matching, AI follow-ups, scheduled campaigns and advanced analytics.
- **Agency — US$50/month:** unlimited listings, up to five agent accounts, shared team capabilities and agency analytics.

Plan entitlements are centralized in `src/lib/plans.ts` so a future billing provider can become the source of subscription changes without scattering plan logic through the UI.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and create a production build |
| `npm run preview` | Preview the production build |

## Security

Never commit `.env.local`, Anthropic keys, Supabase service-role keys, Meta app secrets or WhatsApp access tokens. Use `.env.example` for documented placeholder names only.
