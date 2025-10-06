# SolSwapAI

SolSwapAI enables users to sell SOL/SPL tokens (SOL, USDC, USDT) and receive NGN, guided by a conversational agent.

- backend/: TypeScript + Express API, state machine, pricing, payout stubs, Solana watcher stubs
- frontend/: Vite + React minimal chat UI wired to the backend

## Prerequisites

- Node.js 18+
- npm (or pnpm/yarn)

## Quick Start

1) Backend

```bash
cd backend
# Install deps
npm install
# Create .env and fill values (see below)
# PowerShell example if a template exists:
# Copy-Item -Path .env.example -Destination .env
npm run dev
```

2) Frontend

```bash
cd ../frontend
npm install
npm run dev
```

- Backend: http://localhost:4000
- Frontend: http://localhost:5173 (proxy to backend for /chat and /orders)

## Environment Variables

Backend (.env)

```
PORT=4000
SOLANA_RPC_URL=
SOLANA_COMMITMENT=confirmed
DEPOSIT_STRATEGY=per_order_wallet
HOT_WALLET_PRIVATE_KEY=
SPL_USDC_MINT=
SPL_USDT_MINT=
GEMINI_API_KEY=
COINGECKO_API_KEY=
PAYOUT_PROVIDER=paystack
PAYSTACK_SECRET=
FLUTTERWAVE_SECRET=
SPREAD_BPS=150
NGN_MAX_PER_TX=5000000
CONFIRMATION_BLOCKS=5
WEBHOOK_SECRET=
APP_BASE_URL=http://localhost:4000
```

Frontend (.env)

```
VITE_BACKEND_URL=http://localhost:4000
```

If you change ports, update `frontend/vite.config.ts` and `VITE_BACKEND_URL` accordingly.

## Implemented

- Chat endpoint with simple state machine creating orders and advancing states
- Pricing service (CoinGecko) with NGN FX conversion, caching, and spread
- Payout service stubs (Paystack/Flutterwave), bank capture, payout trigger, webhook stub
- Solana service stubs and background watcher hook
- Minimal React chat UI calling POST /chat/message

## Next Steps

- Real Solana deposit detection (signatures/polling, ATAs for SPL)
- Real payout integrations and webhook signature verification
- DB persistence (SQLite/Postgres) replacing in-memory store
- Auth/rate limiting, robust validation, logging/metrics, production hardening

## Scripts

Backend:
- `npm run dev` — start Express with tsx watch
- `npm run build` — compile TypeScript
- `npm start` — run compiled build

Frontend:
- `npm run dev` — start Vite dev server
- `npm run build` — build for production
- `npm run preview` — preview production build

Security: keep secrets in `.env` (do not commit), use HTTPS RPC/provider endpoints, and consider external signing/KMS for `HOT_WALLET_PRIVATE_KEY` in production.
