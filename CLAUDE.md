# Budget App — CLAUDE.md

## What This Is

A full-stack personal/family budgeting app with multi-user shared budgets, Plaid bank integration, monthly budget sheets, reusable templates, and purchase tracking.

## Project Structure

```
budget/
├── api/          # Fastify REST API (Node.js, ES modules)
├── ui/           # React + TypeScript + Vite frontend
├── database/     # PostgreSQL migration SQL files
├── docs/         # Domain documentation (rollover-logic.md)
└── .github/      # CI/CD pipelines (Render for API, artifact upload for UI)
```

## Running Locally

Start both servers — the UI Vite dev server proxies `/api` to localhost:3000 so there are no CORS issues in dev.

```bash
# Terminal 1 — API (port 3000)
cd api && npm run dev

# Terminal 2 — UI (port 5173)
cd ui && npm run dev
```

No test suite exists currently.

## Tech Stack

**Frontend (`ui/`)**
- React 19 + TypeScript, Vite, Tailwind CSS 4
- React Router DOM 7 for routing
- Custom `apiClient<T>()` fetch wrapper in `ui/src/api/client.ts` — handles auth header injection, 401 redirect, and 204 no-content responses
- `AuthContext` and `BudgetContext` are the two global state providers

**Backend (`api/`)**
- Fastify 5 (ES modules, `"type": "module"` in package.json)
- PostgreSQL via `@fastify/postgres`
- JWT auth via `@fastify/jwt`; tokens expire in `JWT_EXPIRES_IN` (default 24h)
- Plaid SDK for bank account linking

## Key Architecture Patterns

**Everything is scoped to a budget.** Templates, sheets, purchases, linked accounts — all belong to a `budgetId`. There are no global resources.

**Roles**: `owner`, `editor`, `viewer` — enforced per budget via `budget_users` join table. Route handlers call `budgetAccess.js` utilities which query PostgreSQL role-check functions.

**Database does the heavy lifting.** Complex logic lives in PG functions/views:
- `create_sheet_from_template()` — instantiates a monthly budget from a template
- `carry_over_rollover_amounts()` — carries unspent balances forward month-to-month
- `sync_sheet_with_template()` — adds new template items to existing sheets
- `rollover_item_totals` view — computes `rolled_over + budgeted - actual` per rollover line item

**API → DB naming**: DB columns are `snake_case`; API responses convert to `camelCase` manually in each route handler. TypeScript interfaces in `ui/src/types/` document the camelCase shapes.

**Amounts** are PostgreSQL `NUMERIC`, returned as strings in JSON — handle accordingly in UI code.

## Frontend File Map

```
ui/src/
├── api/           # One file per domain: auth, budgets, sheets, templates, purchases, plaid
├── components/    # Shared components: Layout, ProtectedRoute, BudgetSelector, InvitationNotifications
├── contexts/      # AuthContext.tsx, BudgetContext.tsx
├── pages/         # Route-level components: Dashboard, Templates, Purchases, LinkedAccounts, etc.
├── types/         # TypeScript interfaces matching API response shapes
└── App.tsx        # Route definitions
```

## Backend File Map

```
api/src/
├── server.js      # Entry point — registers plugins and route prefixes
├── config.js      # Reads .env, decrypts AES-256-GCM secrets for prod
├── plugins/       # postgres.js, jwt.js, plaid.js
├── routes/        # users.js, budgets.js, templates.js, sheets.js, purchases.js, plaid.js
└── utils/         # budgetAccess.js, csvParser.js, purchaseHash.js, encrypt.js, recaptcha.js
```

Route prefixes registered in `server.js`: `/api/users`, `/api/budgets`, `/api/templates`, `/api/sheets`, `/api/purchases`, `/api/plaid`.

## Environment Variables

**API (`api/.env`):**
```
PORT=3000
HOST=0.0.0.0
DATABASE_HOST / DATABASE_PORT / DATABASE_NAME / DATABASE_USER / DATABASE_PASSWORD
JWT_SECRET / JWT_EXPIRES_IN
PLAID_CLIENT_ID_ENCRYPTED / PLAID_SECRET_ENCRYPTED / PLAID_ENV / PLAID_PRODUCTS / PLAID_COUNTRY_CODES
RECAPTCHA_SECRET_KEY
ENCRYPTION_KEY      # Used to decrypt AES-encrypted secrets
```

**UI (`ui/.env` or `ui/.env.development`):**
```
VITE_API_URL=/api
VITE_RECAPTCHA_SITE_KEY=<recaptcha-public-key>
```

## Notable Gotchas

- **Registration is email-whitelisted** — new users must be in the `allowed_emails` table before they can register.
- **`Content-Type: application/json` is only sent when a body exists** in `apiClient` — DELETE requests have no body, so no content-type header (Fastify rejects DELETE with JSON content-type and empty body).
- **`actual_amount` on sheet line items** is auto-updated by a DB trigger when purchases are linked/unlinked.
- **Plaid sync** uses cursor-based incremental sync stored in `plaid_sync_cursors`.
- **Amounts are strings** when deserialized from JSON (PostgreSQL `NUMERIC` type).
- **JWT in localStorage** — not httpOnly, so consider this when evaluating XSS surface.

## Documentation

- `docs/rollover-logic.md` — explains the month-to-month balance rollover mechanic
- `api/README.md` — full API endpoint reference with request/response examples
