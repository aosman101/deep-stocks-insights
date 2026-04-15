<div align="center">

# Deep Stock Insights

**ML-Powered Financial Market Prediction Platform**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.16-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://tensorflow.org)
[![LightGBM](https://img.shields.io/badge/LightGBM-4.5-9ACD32?style=for-the-badge&logo=microsoft&logoColor=white)](https://lightgbm.readthedocs.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![License](https://img.shields.io/badge/License-Private-red?style=for-the-badge)]()

<br/>

A full-stack platform that combines **N-HiTS** and **Temporal Fusion Transformer (TFT)** neural forecasters, **LightGBM / XGBoost** gradient boosting, an **autonomous paper-trading agent**, and **Monte Carlo simulations** to analyse **43 assets** — cryptocurrencies, equities, and commodities — with real-time feeds, technical analysis, and walk-forward backtesting.

<br/>

[Getting Started](#getting-started) · [Features](#features) · [Architecture](#architecture) · [API Reference](#api-reference) · [Models](#ml-models)

</div>

---

## Features

### Prediction Engine
- **N-HiTS (Neural Hierarchical Interpolation for Time Series)** — Multi-resolution temporal forecasting with MC-Dropout uncertainty quantification across 1-day, 3-day, and 7-day horizons.
- **Temporal Fusion Transformer (TFT)** — Attention-based multi-horizon model with interpretable variable selection, available for the same featured asset set as N-HiTS.
- **LightGBM & XGBoost** — Gradient-boosted tree models for rapid next-close predictions and full-market scanning.
- **Monte Carlo Simulations** — Probabilistic fan charts showing forecast confidence bounds.
- **Walk-Forward Backtesting** — Rolling-window evaluation with MAE, RMSE, MAPE, R², directional accuracy, Sharpe ratio, and max drawdown.
- **Inference Workers** — Background prediction refresh pool that keeps forecasts warm for priority assets without blocking API requests.

### AI Trading Agent
- **Paper-trading sessions** — Create persistent agent sessions with configurable risk budget, horizon, and strategy.
- **Decision cycles** — Each cycle pulls fresh model output, opens/closes trades, and snapshots the portfolio equity curve.
- **Performance tracking** — Per-session stats, trade history, equity curve, and win/loss accounting.

### Market Data & Analysis
- **Real-Time WebSocket Feeds** — Live price streaming for any supported asset via `/ws/prices/{asset}`.
- **18+ Technical Indicators** — RSI, MACD, Stochastic Oscillator, ADX, ATR, Williams %R, CCI, Bollinger Bands, SMA/EMA, Pivot Points, VWAP, and more.
- **Macro Dashboard** — Fear & Greed index, FRED economic series, Finnhub news and sentiment.
- **Market Scanner** — LightGBM-driven signal ranking with buy/sell probability scores across the full asset universe.

### Platform
- **43 Supported Assets** — 18 cryptocurrencies, 20 stocks, 5 commodities (20 with full N-HiTS and TFT pre-trained weights).
- **Model Health Tracking** — Per-asset, per-model status, version, and recent prediction accuracy surfaced via `/health`.
- **Runtime Snapshot Caching** — Shared analytics / evaluation snapshots to keep heavy views responsive.
- **Interactive Charts** — Candlestick OHLC, volume bars, indicator overlays, correlation heatmaps, Monte Carlo cones.
- **Educational Hub** — Guides covering technical indicators, trading concepts, glossary, and market session hours.
- **JWT Authentication** — Role-based access control with admin and user roles, request-ID tracing, and rate limiting.
- **Admin Panel** — User management, per-asset training triggers (N-HiTS / TFT / LightGBM), model health, and system stats.

---

## Supported Assets

| Category | Assets |
|----------|--------|
| **Crypto** | BTC, ETH, SOL, XRP, BNB, ADA, DOGE, AVAX, LTC, LINK, UNI, ATOM, XLM, ALGO, NEAR, FIL, DOT, MATIC |
| **Stocks** | AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, NFLX, JPM, V, JNJ, WMT, DIS, AMD, PYPL, COIN, SHOP, UBER, SQ, BABA |
| **Commodities** | GOLD, SILVER, OIL, GAS, DIESEL |

> Assets with full N-HiTS **and** TFT support (pre-trained weights): BTC, ETH, SOL, XRP, BNB, ADA, DOGE, AVAX, GOLD, SILVER, OIL, GAS, DIESEL, AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA. Any other valid yfinance ticker also works via the open-search fallback (LightGBM only).

---

## Architecture

```
deep-stock-insights/
├── docker-compose.yml          # Postgres + backend + frontend + nginx stack
├── nginx/                      # Reverse proxy config + TLS certs
├── backend/                    # FastAPI server
│   ├── main.py                 # App entry, lifespan, scheduler, workers
│   ├── init_db.py              # DB init & admin seeding
│   ├── alembic/                # DB migrations
│   ├── Dockerfile
│   ├── models/                 # Pre-trained model weights (.h5, .pkl)
│   └── app/
│       ├── config.py           # Pydantic settings & env vars
│       ├── database.py         # SQLAlchemy engine & session
│       ├── logging_config.py   # Structured logs with request IDs
│       ├── ml/
│       │   ├── nhits_model.py  # N-HiTS architecture (Keras)
│       │   ├── tft_model.py    # Temporal Fusion Transformer
│       │   ├── lstm_model.py   # Legacy LSTM compatibility layer
│       │   └── preprocessing.py
│       ├── models/             # SQLAlchemy ORM
│       │   ├── user.py         # Users & roles
│       │   ├── prediction.py   # Predictions & model metrics
│       │   ├── agent.py        # Agent sessions, trades, snapshots
│       │   └── price_cache.py  # OHLCV cache & live quotes
│       ├── routers/            # API routes
│       │   ├── auth.py         ├── admin.py       ├── market.py
│       │   ├── predictions.py  ├── analytics.py   ├── macro.py
│       │   ├── scanner.py      ├── finnhub.py     ├── twelvedata.py
│       │   ├── agent.py        # AI trading agent
│       │   └── ws.py           # WebSocket live feed
│       ├── services/           # Business logic
│       │   ├── asset_registry.py         ├── prediction_service.py
│       │   ├── lightgbm_service.py       ├── xgboost_service.py
│       │   ├── indicators_service.py     ├── market_service.py
│       │   ├── model_evaluation_service.py
│       │   ├── model_health_service.py   ├── model_output_service.py
│       │   ├── risk_service.py           ├── macro_service.py
│       │   ├── scanner_service.py        ├── finnhub_service.py
│       │   ├── twelvedata_service.py
│       │   ├── prediction_record_service.py
│       │   ├── runtime_snapshot_service.py   # cached analytics snapshots
│       │   ├── training_job_service.py       # async training jobs
│       │   ├── inference_worker_service.py   # background prediction pool
│       │   └── agent_service.py              # agent decision cycles
│       └── schemas/            # Pydantic request/response models
│
└── frontend/                   # React + Vite SPA
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx             # Routing & lazy-loaded pages
        ├── main.jsx
        ├── context/            # AuthContext, ToastContext
        ├── hooks/              # useWebSocket, etc.
        ├── services/api.js     # Axios client with caching & 401 handling
        ├── pages/
        │   ├── HomePage.jsx          ├── PredictPage.jsx
        │   ├── GraphAnalysisPage.jsx ├── ComparisonPage.jsx
        │   ├── AIInsightsPage.jsx    ├── AgentPage.jsx
        │   ├── CryptoPredictionsPage.jsx
        │   ├── StockPredictionsPage.jsx
        │   ├── LearnPage.jsx         ├── AdminPage.jsx
        │   ├── ProfilePage.jsx
        │   ├── LoginPage.jsx         └── RegisterPage.jsx
        └── components/
            ├── layout/         # AppShell, Navbar, Sidebar
            ├── charts/         # PriceChart, IndicatorChart,
            │                   # MonteCarloCone, CorrelationHeatmap
            └── ui/             # AssetSelector, SignalBadge, StatCard,
                                # FearGreedGauge, MacroCard, NewsFeed,
                                # LoadingSpinner
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Tailwind CSS, Recharts, Axios, React Router |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, Pydantic, SlowAPI (rate limiting) |
| **ML / AI** | TensorFlow/Keras (N-HiTS, TFT), LightGBM, XGBoost, scikit-learn, NumPy, Pandas |
| **Database** | SQLite (default) or PostgreSQL via `DATABASE_URL`; Alembic migrations |
| **Auth** | JWT (python-jose), bcrypt, role-based access control |
| **Data Sources** | yFinance, CoinGecko, GoldAPI, FRED, Finnhub, Twelve Data |
| **Scheduling** | APScheduler (quotes, verification, priority refresh) |
| **Real-Time** | WebSocket (`/ws/prices/{asset}`) |
| **Deployment** | Docker Compose (Postgres + backend + frontend + nginx with TLS) |

---

## Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **pip** and **npm**
- **Docker + Docker Compose** (optional, for the full stack)

### 1. Clone the Repository

```bash
git clone https://github.com/aosman101/deep-stocks-insights.git
cd deep-stocks-insights
```

### 2. Backend Setup

```bash
cd backend

python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env        # edit as needed (see Environment Variables)

uvicorn main:app --reload --port 8000
```

API available at `http://localhost:8000`, interactive docs at `/docs`, ReDoc at `/redoc`, health at `/health`.

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App available at `http://localhost:5173`.

### 4. Train Models (Optional)

Trigger N-HiTS or TFT training from the admin panel, or via the API:

```bash
# N-HiTS (default)
curl -X POST http://localhost:8000/api/admin/train/BTC \
  -H "Authorization: Bearer <admin_token>"

# TFT
curl -X POST "http://localhost:8000/api/admin/train/BTC?model_key=tft" \
  -H "Authorization: Bearer <admin_token>"
```

### 5. Docker Compose (Full Stack)

```bash
# from repo root
docker compose up -d --build
```

Brings up Postgres, the FastAPI backend, the built frontend, and an nginx reverse proxy (ports 80/443). Certs live in `nginx/certs/`.

---

## Environment Variables

Create a `.env` file in `backend/`:

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | JWT signing key (use a long random string in production) |
| `DEBUG` | No | Enable debug mode (default: `true`) |
| `DATABASE_URL` | No | DB connection string (default: SQLite file) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |
| `ADMIN_EMAIL` / `ADMIN_USERNAME` / `ADMIN_PASSWORD` | No | Bootstrap admin account on first run |
| `MODEL_SAVE_PATH` | No | Directory for saved model weights |
| `MODEL_RETRAIN_ON_STARTUP` | No | Retrain featured assets at boot (default: `false`) |
| `INFERENCE_WORKER_COUNT` | No | Number of background inference workers |
| `PREDICTION_PRIORITY_ASSETS` | No | Comma-separated list kept warm by the refresh job |
| `PREDICTION_REFRESH_MINUTES` | No | Interval for the priority prediction refresh job |
| `GOLD_API_KEY` | No | [goldapi.io](https://goldapi.io) — live gold/silver prices |
| `FRED_API_KEY` | No | [FRED](https://fred.stlouisfed.org/docs/api/api_key.html) — macro series |
| `FINNHUB_API_KEY` | No | [Finnhub](https://finnhub.io) — news, sentiment, profiles |
| `TWELVE_DATA_API_KEY` | No | [Twelve Data](https://twelvedata.com) — time series, forex |

> The platform runs without any third-party API keys — yFinance and CoinGecko provide free data as fallbacks.

---

## API Reference

| Group | Prefix | Description |
|-------|--------|-------------|
| **Auth** | `/api/auth` | Login, register, profile |
| **Market** | `/api/market` | Live quotes, OHLCV history, indicators, risk levels |
| **Predictions** | `/api/predictions` | N-HiTS / TFT forecasts (1d / 3d / 5d / 7d) |
| **Analytics** | `/api/analytics` | Statistical estimates, Monte Carlo, walk-forward backtests |
| **Macro** | `/api/macro` | Fear & Greed index, FRED economic data |
| **Scanner** | `/api/scanner` | LightGBM market scan with signal ranking |
| **Finnhub** | `/api/finnhub` | Market news and sentiment |
| **Twelve Data** | `/api/twelvedata` | Alternative time series and indicators |
| **Agent** | `/api/agent` | AI paper-trading sessions, cycles, trades, equity |
| **Admin** | `/api/admin` | Users, model training, model health, system stats |
| **WebSocket** | `/ws/prices/{asset}` | Real-time price streaming |
| **Health** | `/` and `/health` | Liveness and per-asset model status |

Full interactive docs at `/docs` (Swagger) and `/redoc`.

---

## ML Models

### N-HiTS — Neural Hierarchical Interpolation for Time Series
Primary deep forecaster implemented in Keras/TensorFlow.
- Multi-resolution pooling at levels 1, 2, and 5 to capture multiple temporal scales.
- Residual backcast architecture — each block subtracts its explained signal before the next.
- MC-Dropout inference (50 forward passes) for uncertainty bands.
- Custom loss: `0.8 * MSE + 0.2 * directional_penalty`.
- Adam optimiser, early stopping (patience 12), LR reduction on plateau.
- Outputs predicted close price and percentage change per horizon.

### TFT — Temporal Fusion Transformer
Attention-based multi-horizon model used alongside N-HiTS for comparison and ensembling.
- Variable selection networks and multi-head attention over static, known, and observed inputs.
- Shares the featured asset set with N-HiTS; weights versioned and surfaced via `/health`.

### LightGBM / XGBoost
Gradient-boosted trees trained per asset for fast predictions.
- Drive the **Market Scanner** ranking and the **AI Insights** view.
- Instant next-close estimates, no GPU required.
- Pre-trained `.pkl` models shipped for the full asset catalogue.

### Evaluation Metrics (walk-forward)

| Metric | Description |
|--------|-------------|
| MAE | Mean Absolute Error |
| RMSE | Root Mean Squared Error |
| MAPE | Mean Absolute Percentage Error |
| R² | Coefficient of determination |
| Directional Accuracy | % of correctly predicted up/down moves |
| Sharpe Ratio | Risk-adjusted return |
| Max Drawdown | Largest peak-to-trough decline |

---

## Background Jobs

APScheduler runs the following jobs on the backend:

| Job | Interval | Purpose |
|-----|----------|---------|
| **Quote Refresh** | 60 seconds | Keeps the live price cache current for featured assets |
| **Prediction Verification** | 6 hours | Fills `actual_close` for past predictions, recomputes accuracy, refreshes history metrics |
| **Priority Prediction Refresh** | `PREDICTION_REFRESH_MINUTES` | Re-queues N-HiTS / TFT / analytics for hot assets via the inference worker pool |

---

## Disclaimer

> This platform is built for **educational and research purposes**. Predictions are generated by machine learning models and **should not be used as sole investment advice**. Always do your own research and consult a financial advisor before making investment decisions.

---

<div align="center">

Built with FastAPI, React, TensorFlow, LightGBM, and XGBoost

</div>
