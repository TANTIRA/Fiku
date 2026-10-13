# Fuku

Fuku is a personal finance assistant with an 8-bit pixel mascot. Type or say things like "makan siang 25rb" and Fuku records the transaction, picks the category, and answers questions about your spending.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind 4)
- Supabase (Postgres) as the ledger and system of record, with RLS per user
- TypeDB as the ontology projection (category hierarchy, counterparties, learned mappings)
- Streaming chat via the AI SDK with tools, plus an offline Indonesian rule-based fallback

## Prerequisites

- Node.js 20+
- Docker
- Supabase CLI
- TypeDB CLI (optional if you already run TypeDB elsewhere)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the env file and fill in the values:

```bash
cp .env.example .env.local
```

3. Start infrastructure:

```bash
npm run infra:up
npm run typedb:setup
```

This starts TypeDB (localhost:8000, database `fuku`) and the local Supabase stack. Apply migrations with:

```bash
supabase db reset
```

4. Generate icons (already committed, only needed if you change the sprite):

```bash
npm run gen:icons
```

5. Run the dev server:

```bash
npm run dev
```

Open http://localhost:3000, sign up, and start talking to Fuku.

## Environment variables

See `.env.example` for the full list.

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - local Supabase API
- `TYPEDB_URL`, `TYPEDB_USER`, `TYPEDB_PASSWORD`, `TYPEDB_DATABASE` - TypeDB HTTP API
- `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` - optional OpenAI-compatible provider

If no LLM key is configured, the assistant falls back to a deterministic Indonesian rule-based brain, so the app works fully offline.

## Scripts

- `npm run dev` - dev server
- `npm run build` - production build
- `npm run start` - serve the production build
- `npm run lint` - ESLint
- `npm run typecheck` - TypeScript check
- `npm run infra:up` / `infra:down` / `infra:status` - manage Docker infra
- `npm run typedb:setup` - create TypeDB database and schema (idempotent)
- `npm run gen:icons` - regenerate app icons from the sprite

## How it works

1. Messages go to `src/app/api/chat/route.ts`, which exposes tools (`recordTransactions`, `getMonthlySummary`, `findTransactions`, `topPlaces`, `deleteTransaction`).
2. `src/lib/parser.ts` parses Indonesian free text (amounts, dates, categories) deterministically.
3. `src/lib/finance.ts` reads and writes Postgres through Supabase with the user's session.
4. `src/lib/ontology.ts` mirrors category hierarchy and counterparty knowledge into TypeDB; the dashboard falls back to a local hierarchy walk if the TypeDB totals drift from the ledger.

## License

See [LICENSE](./LICENSE).
