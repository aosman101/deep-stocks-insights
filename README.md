# Deep Stock Insights

Personal full-stack stock and crypto analysis site built with FastAPI and React.

## What It Does

- Shows market data, charts, indicators, and model-based predictions
- Includes authentication, admin tools, and an AI-style market scanner
- Uses a FastAPI backend and a Vite/React frontend

## Stack

- Backend: FastAPI, SQLAlchemy, APScheduler, TensorFlow, LightGBM
- Frontend: React, Vite, Tailwind, Recharts
- Data: yFinance, CoinGecko, optional third-party APIs

## Run Locally

### Backend

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

Backend URLs:

- `http://127.0.0.1:8000`
- `http://127.0.0.1:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend URL:

- `http://localhost:5173`

## Environment

Create `backend/.env` if needed. Main values:

```env
SECRET_KEY=your-secret
DEBUG=true
DATABASE_URL=sqlite:////tmp/deep_stock_insights.db
ADMIN_EMAIL=admin@example.com
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
```

Optional API keys:

- `GOLD_API_KEY`
- `FRED_API_KEY`
- `FINNHUB_API_KEY`
- `TWELVE_DATA_API_KEY`

The app still works without them, using free fallbacks where available.

## Docker

From the repo root:

```bash
docker compose up --build
```

## Project Structure

```text
backend/   FastAPI app and ML logic
frontend/  React app
nginx/     Reverse proxy config
```

## Notes

- This is a personal project, not a production platform
- Predictions are experimental and not financial advice
