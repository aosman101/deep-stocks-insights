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

A full-stack platform that combines **N-HiTS neural temporal models**, **LightGBM gradient boosting**, and **Monte Carlo simulations** to forecast prices across **53 assets** — cryptocurrencies, equities, and commodities — with real-time data feeds, technical analysis, and walk-forward backtesting.

<br/>

[Getting Started](#-getting-started) · [Features](#-features) · [Architecture](#-architecture) · [API Reference](#-api-reference) · [Models](#-ml-models)

</div>

---

## Features

### Prediction Engine
- **N-HiTS (Neural Hierarchical Interpolation for Time Series)** — Multi-resolution temporal forecasting with MC-dropout uncertainty quantification across 1-day, 3-day, and 7-day horizons
- **LightGBM & XGBoost** — Gradient-boosted tree models for rapid next-close predictions and full market scanning
- **Monte Carlo Simulations** — Probabilistic fan charts showing forecast confidence bounds
- **Walk-Forward Backtesting** — Rolling-window model evaluation with MAE, RMSE, MAPE, R², Sharpe ratio, and max drawdown metrics

### Market Data & Analysis
- **Real-Time WebSocket Feeds** — Live price streaming for any supported asset
- **18+ Technical Indicators** — RSI, MACD, Stochastic Oscillator, ADX, ATR, Williams %R, CCI, Bollinger Bands, SMA/EMA, Pivot Points, VWAP, and more
- **Macro-Economic Dashboard** — Fear & Greed index, FRED economic series integration
- **Market Scanner** — AI-driven signal ranking with buy/sell probability scores

### Platform
- **53 Supported Assets** — 25 cryptocurrencies, 20 stocks, 5 commodities (17 with full N-HiTS support).
- **Interactive Charts** — Candlestick OHLC, volume bars, indicator overlays, correlation heatmaps.
- **Model Comparison** — Side-by-side benchmarking of N-HiTS vs LightGBM vs ensemble vs baseline.
- **Educational Hub** — Guides on technical analysis, risk management, market structure, and trading psychology.
- **JWT Authentication** — Role-based access control with admin and user roles.
- **Admin Panel** — User management, per-asset model training triggers, system health monitoring.

---

## Supported Assets

| Category | Assets |
|----------|--------|
| **Crypto** | BTC, ETH, SOL, XRP, BNB, ADA, DOGE, AVAX, LTC, LINK, UNI, ATOM, XLM, ALGO, NEAR, FIL, DOT, MATIC |
| **Stocks** | AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, NFLX, JPM, V, JNJ, WMT, DIS, AMD, PYPL, COIN, SHOP, UBER, BABA |
| **Commodities** | GOLD, SILVER, OIL, GAS, DIESEL |

> Assets marked as **featured** (BTC, ETH, SOL, XRP, BNB, ADA, DOGE, AVAX, AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, GOLD, SILVER) have full N-HiTS model support with pre-trained weights.

---

## Architecture

```
deep-stock-insights/
├── backend/                    # FastAPI server
│   ├── main.py                 # App entry point, lifespan, scheduler
│   ├── init_db.py              # Database initialisation & admin seeding
│   ├── requirements.txt
│   ├── models/                 # Pre-trained model weights (.h5, .pkl)
│   └── app/
│       ├── config.py           # Pydantic settings & env vars
│       ├── database.py         # SQLAlchemy engine & session
│       ├── ml/
│       │   ├── nhits_model.py  # N-HiTS architecture (Keras)
│       │   ├── lstm_model.py   # LSTM compatibility layer
│       │   └── preprocessing.py # Feature engineering & normalisation
│       ├── models/             # SQLAlchemy ORM models
│       │   ├── user.py         # User accounts & roles
│       │   ├── prediction.py   # Predictions & model metrics
│       │   └── price_cache.py  # OHLCV cache & live quotes
│       ├── routers/            # API route handlers
│       │   ├── auth.py         # /api/auth — login, register, profile
│       │   ├── admin.py        # /api/admin — user & model management
│       │   ├── market.py       # /api/market — quotes, history, indicators
│       │   ├── predictions.py  # /api/predictions — N-HiTS forecasts
│       │   ├── analytics.py    # /api/analytics — statistical estimates
│       │   ├── macro.py        # /api/macro — economic data
│       │   ├── scanner.py      # /api/scanner — market scanner
│       │   ├── finnhub.py      # /api/finnhub — news & sentiment
│       │   ├── twelvedata.py   # /api/twelvedata — time series
│       │   └── ws.py           # /ws/prices — WebSocket live feed
│       ├── services/           # Business logic layer
│       │   ├── asset_registry.py
│       │   ├── prediction_service.py
│       │   ├── lightgbm_service.py
│       │   ├── indicators_service.py
│       │   ├── market_service.py
│       │   ├── model_evaluation_service.py
│       │   ├── risk_service.py
│       │   ├── macro_service.py
│       │   └── scanner_service.py
│       └── schemas/            # Pydantic request/response schemas
│
└── frontend/                   # React + Vite SPA
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx             # Routing & layout
        ├── main.jsx            # Entry point
        ├── context/
        │   ├── AuthContext.jsx  # JWT auth state
        │   └── ToastContext.jsx # Notifications
        ├── hooks/
        │   └── useWebSocket.js # Live price hook
        ├── services/
        │   └── api.js          # Axios client with caching
        ├── pages/
        │   ├── HomePage.jsx         # Market overview dashboard
        │   ├── PredictPage.jsx      # Multi-model predictions
        │   ├── GraphAnalysisPage.jsx # Technical analysis charts
        │   ├── ComparisonPage.jsx   # Model benchmarking
        │   ├── AIInsightsPage.jsx   # LightGBM market scanner
        │   ├── LearnPage.jsx        # Educational content
        │   ├── AdminPage.jsx        # Admin panel
        │   ├── ProfilePage.jsx      # User profile
        │   ├── LoginPage.jsx
        │   └── RegisterPage.jsx
        └── components/
            ├── AppShell.jsx         # Layout shell
            ├── Navbar.jsx
            ├── Sidebar.jsx
            ├── PriceChart.jsx       # Candlestick OHLC
            ├── IndicatorChart.jsx   # Technical indicators
            ├── MonteCarloCone.jsx   # Probability fan chart
            ├── CorrelationHeatmap.jsx
            ├── AssetSelector.jsx
            ├── SignalBadge.jsx
            ├── FearGreedGauge.jsx
            ├── MacroCard.jsx
            ├── StatCard.jsx
            ├── NewsFeed.jsx
            └── LoadingSpinner.jsx
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, Tailwind CSS, Recharts, Axios, React Router |
| **Backend** | Python, FastAPI, Uvicorn, Pydantic |
| **ML/AI** | TensorFlow/Keras (N-HiTS), LightGBM, XGBoost, scikit-learn, NumPy, Pandas |
| **Database** | SQLite (default) / PostgreSQL via `DATABASE_URL` |
| **Auth** | JWT (python-jose), bcrypt |
| **Data Sources** | yFinance, CoinGecko, GoldAPI, FRED, Finnhub, Twelve Data |
| **Scheduling** | APScheduler (quote refresh, prediction verification) |
| **Real-Time** | WebSocket (live price feeds) |

---

## Getting Started

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **pip** and **npm**

### 1. Clone the Repository

```bash
git clone https://github.com/aosman101/deep-stocks-insights.git
cd deep-stocks-insights
```

### 2. Backend Setup

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings (see Environment Variables below)

# Start the server
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000` with interactive docs at `/docs`.

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The app will be available at `http://localhost:5173`.

### 4. Train Models (Optional)

Once the backend is running, trigger N-HiTS training for any featured asset via the admin panel or API:

```bash
# Train a specific asset (requires admin JWT)
curl -X POST http://localhost:8000/api/admin/train/BTC \
  -H "Authorisation: Bearer <admin_token>"
```

---

## Environment Variables

Create a `.env` file in the `backend/` directory:

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | JWT signing key (generate a random string for production) |
| `DEBUG` | No | Enable debug mode (default: `true`) |
| `DATABASE_URL` | No | Database connection string (default: SQLite) |
| `ADMIN_EMAIL` | No | Bootstrap admin account email |
| `ADMIN_USERNAME` | No | Bootstrap admin username |
| `ADMIN_PASSWORD` | No | Bootstrap admin password |
| `GOLD_API_KEY` | No | [goldapi.io](https://goldapi.io) — live gold/silver prices |
| `FRED_API_KEY` | No | [FRED](https://fred.stlouisfed.org/docs/api/api_key.html) — macro-economic series |
| `FINNHUB_API_KEY` | No | [Finnhub](https://finnhub.io) — news, sentiment, company profiles |
| `TWELVE_DATA_API_KEY` | No | [Twelve Data](https://twelvedata.com) — time series, forex |

> The platform works without any API keys — yFinance and CoinGecko provide free data as fallbacks.

---

## API Reference

| Endpoint Group | Prefix | Description |
|----------------|--------|-------------|
| **Auth** | `/api/auth` | Login, register, profile management |
| **Market** | `/api/market` | Live quotes, OHLCV history, technical indicators, risk levels |
| **Predictions** | `/api/predictions` | N-HiTS model forecasts (1d / 3d / 7d horizons) |
| **Analytics** | `/api/analytics` | Statistical estimates, Monte Carlo sims, backtesting |
| **Macro** | `/api/macro` | Fear & Greed index, FRED economic data |
| **Scanner** | `/api/scanner` | LightGBM market scan with signal ranking |
| **Finnhub** | `/api/finnhub` | Market news and sentiment analysis |
| **Twelve Data** | `/api/twelvedata` | Alternative time series and indicators |
| **Admin** | `/api/admin` | User management, model training, system stats |
| **WebSocket** | `/ws/prices/{asset}` | Real-time price streaming |

Full interactive documentation is available at `/docs` (Swagger UI) and `/redoc` when the backend is running.

---

## ML Models

### N-HiTS (Neural Hierarchical Interpolation for Time Series)

The primary forecasting model, implemented in Keras/TensorFlow:

- **Multi-resolution pooling** at levels 1, 2, and 5 for capturing patterns at different temporal scales
- **Residual backcast architecture** — each block subtracts its explained signal before passing to the next
- **MC-Dropout inference** — 50 forward passes at prediction time to quantify uncertainty
- **Custom loss function** — `0.8 * MSE + 0.2 * directional_penalty` to optimise both magnitude and direction
- **Training** — Adam optimiser, early stopping (patience 12), LR reduction on plateau
- **Outputs** — Predicted close price and percentage change for each horizon

### LightGBM / XGBoost

Gradient-boosted tree models trained per-asset for fast predictions:

- Used by the **Market Scanner** for ranking assets by buy/sell signal strength
- Provides instant next-close estimates without GPU requirements
- Pre-trained `.pkl` models for all 53 supported assets

### Evaluation Metrics

All models are evaluated with walk-forward backtesting:

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

The backend runs two scheduled tasks via APScheduler:

| Job | Interval | Purpose |
|-----|----------|---------|
| **Quote Refresh** | Every 60 seconds | Updates live price cache for featured assets |
| **Prediction Verification** | Every 6 hours | Fills in `actual_close` for past predictions and computes accuracy |

---

## Disclaimer

> This platform is built for **educational and research purposes**. Predictions are generated by machine learning models and **should not be used as sole investment advice**. Please always do your own research and consult a financial advisor before making investment decisions.

---

<div align="center">

Built with FastAPI, React, TensorFlow, and LightGBM

</div>
