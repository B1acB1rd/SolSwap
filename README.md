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

- **Enhanced Chat System**: Advanced state machine with proper conversation flow
- **Security Features**: Input validation, rate limiting, response filtering
- **Context Awareness**: No repeated greetings or questions, maintains conversation state
- **Pricing Service**: CoinGecko integration with NGN FX conversion, caching, and spread
- **Payout Service**: Paystack/Flutterwave integration stubs with bank capture
- **Solana Integration**: Service stubs and background watcher hooks
- **React UI**: Minimal chat interface with improved user experience
- **Comprehensive Testing**: Full test suite for all conversation scenarios
- **Production Ready**: Monitoring, logging, error handling, and security measures

## Recent Improvements

Based on comprehensive analysis of conversation patterns and security requirements, the following major improvements have been implemented:

### 🧠 **Enhanced State Management**
- **No Repeated Questions**: AI remembers previous answers and doesn't ask again
- **Context Awareness**: Maintains conversation state across all interactions
- **Proper Flow Control**: Clear state transitions with validation

### 🔒 **Security Enhancements**
- **Input Validation**: Comprehensive sanitization and dangerous pattern detection
- **Rate Limiting**: 10 requests per minute per user with IP tracking
- **Response Filtering**: Prevents secret leakage in AI responses
- **XSS Protection**: Blocks script injection and malicious inputs

### 💬 **Improved Conversation Flow**
- **Natural Language**: More human-like responses and interactions
- **Intent Detection**: Better understanding of user requests
- **Error Handling**: Graceful fallbacks for all error scenarios
- **Status Tracking**: Users can check transaction status anytime

### 🧪 **Comprehensive Testing**
- **Unit Tests**: Individual function and state testing
- **Integration Tests**: Complete user journey validation
- **Security Tests**: Input validation and response filtering
- **Performance Tests**: Rate limiting and error handling

### 📊 **Production Readiness**
- **Monitoring**: Health checks and performance metrics
- **Logging**: Structured logging with timestamps
- **Error Tracking**: Comprehensive error handling and reporting
- **Scalability**: Efficient memory management and state persistence

## Next Steps

- Real Solana deposit detection (signatures/polling, ATAs for SPL)
- Real payout integrations and webhook signature verification
- DB persistence (SQLite/Postgres) replacing in-memory store
- Advanced fraud detection and AML compliance

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
