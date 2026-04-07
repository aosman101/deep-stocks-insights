"""
Deep Stock Insights - Asset Registry
Curated catalog of top cryptocurrencies and stocks.
Also supports open search for any valid yfinance ticker.
"""

CRYPTO_ASSETS = {
    "BTC":   {"name": "Bitcoin",          "ticker": "BTC-USD",  "coingecko_id": "bitcoin",        "type": "crypto"},
    "ETH":   {"name": "Ethereum",         "ticker": "ETH-USD",  "coingecko_id": "ethereum",       "type": "crypto"},
    "BNB":   {"name": "BNB",              "ticker": "BNB-USD",  "coingecko_id": "binancecoin",    "type": "crypto"},
    "SOL":   {"name": "Solana",           "ticker": "SOL-USD",  "coingecko_id": "solana",         "type": "crypto"},
    "XRP":   {"name": "XRP",              "ticker": "XRP-USD",  "coingecko_id": "ripple",         "type": "crypto"},
    "ADA":   {"name": "Cardano",          "ticker": "ADA-USD",  "coingecko_id": "cardano",        "type": "crypto"},
    "DOGE":  {"name": "Dogecoin",         "ticker": "DOGE-USD", "coingecko_id": "dogecoin",       "type": "crypto"},
    "AVAX":  {"name": "Avalanche",        "ticker": "AVAX-USD", "coingecko_id": "avalanche-2",    "type": "crypto"},
    "DOT":   {"name": "Polkadot",         "ticker": "DOT-USD",  "coingecko_id": "polkadot",       "type": "crypto"},
    "MATIC": {"name": "Polygon",          "ticker": "MATIC-USD","coingecko_id": "matic-network",  "type": "crypto"},
    "LTC":   {"name": "Litecoin",         "ticker": "LTC-USD",  "coingecko_id": "litecoin",       "type": "crypto"},
    "LINK":  {"name": "Chainlink",        "ticker": "LINK-USD", "coingecko_id": "chainlink",      "type": "crypto"},
    "UNI":   {"name": "Uniswap",          "ticker": "UNI-USD",  "coingecko_id": "uniswap",        "type": "crypto"},
    "ATOM":  {"name": "Cosmos",           "ticker": "ATOM-USD", "coingecko_id": "cosmos",         "type": "crypto"},
    "XLM":   {"name": "Stellar",          "ticker": "XLM-USD",  "coingecko_id": "stellar",        "type": "crypto"},
    "ALGO":  {"name": "Algorand",         "ticker": "ALGO-USD", "coingecko_id": "algorand",       "type": "crypto"},
    "NEAR":  {"name": "NEAR Protocol",    "ticker": "NEAR-USD", "coingecko_id": "near",           "type": "crypto"},
    "FIL":   {"name": "Filecoin",         "ticker": "FIL-USD",  "coingecko_id": "filecoin",       "type": "crypto"},
    "GOLD":  {"name": "Gold (Futures)",   "ticker": "GC=F",     "coingecko_id": None,             "type": "commodity"},
    "SILVER":{"name": "Silver (Futures)", "ticker": "SI=F",     "coingecko_id": None,             "type": "commodity"},
    "GAS":   {"name": "Gasoline (Futures)", "ticker": "RB=F",    "coingecko_id": None,             "type": "commodity"},
    "OIL":   {"name": "Crude Oil (Futures)", "ticker": "CL=F",   "coingecko_id": None,             "type": "commodity"},
    "DIESEL":{"name": "Diesel / Heating Oil", "ticker": "HO=F",  "coingecko_id": None,             "type": "commodity"},
}

STOCK_ASSETS = {
    "AAPL":  {"name": "Apple",              "ticker": "AAPL",  "sector": "Technology",      "type": "stock"},
    "MSFT":  {"name": "Microsoft",          "ticker": "MSFT",  "sector": "Technology",      "type": "stock"},
    "NVDA":  {"name": "NVIDIA",             "ticker": "NVDA",  "sector": "Technology",      "type": "stock"},
    "GOOGL": {"name": "Alphabet",           "ticker": "GOOGL", "sector": "Technology",      "type": "stock"},
    "AMZN":  {"name": "Amazon",             "ticker": "AMZN",  "sector": "Consumer",        "type": "stock"},
    "META":  {"name": "Meta Platforms",     "ticker": "META",  "sector": "Technology",      "type": "stock"},
    "TSLA":  {"name": "Tesla",              "ticker": "TSLA",  "sector": "Automotive",      "type": "stock"},
    "NFLX":  {"name": "Netflix",            "ticker": "NFLX",  "sector": "Entertainment",   "type": "stock"},
    "JPM":   {"name": "JPMorgan Chase",     "ticker": "JPM",   "sector": "Finance",         "type": "stock"},
    "V":     {"name": "Visa",               "ticker": "V",     "sector": "Finance",         "type": "stock"},
    "JNJ":   {"name": "Johnson & Johnson",  "ticker": "JNJ",   "sector": "Healthcare",      "type": "stock"},
    "WMT":   {"name": "Walmart",            "ticker": "WMT",   "sector": "Retail",          "type": "stock"},
    "DIS":   {"name": "Walt Disney",        "ticker": "DIS",   "sector": "Entertainment",   "type": "stock"},
    "AMD":   {"name": "AMD",                "ticker": "AMD",   "sector": "Technology",      "type": "stock"},
    "PYPL":  {"name": "PayPal",             "ticker": "PYPL",  "sector": "Finance",         "type": "stock"},
    "COIN":  {"name": "Coinbase",           "ticker": "COIN",  "sector": "Finance",         "type": "stock"},
    "SHOP":  {"name": "Shopify",            "ticker": "SHOP",  "sector": "Technology",      "type": "stock"},
    "UBER":  {"name": "Uber",               "ticker": "UBER",  "sector": "Transport",       "type": "stock"},
    "SQ":    {"name": "Block (Square)",     "ticker": "SQ",    "sector": "Finance",         "type": "stock"},
    "BABA":  {"name": "Alibaba",            "ticker": "BABA",  "sector": "Technology",      "type": "stock"},
}

ALL_ASSETS = {**CRYPTO_ASSETS, **STOCK_ASSETS}

# Featured assets that have N-HiTS model support
NHITS_FEATURED = {
    # Crypto
    "BTC", "ETH", "SOL", "XRP", "BNB", "ADA", "DOGE", "AVAX",
    # Commodities
    "GOLD", "SILVER", "GAS", "OIL", "DIESEL",
    # Stocks
    "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA",
}


def get_asset(symbol: str) -> dict | None:
    """Return asset metadata for a known symbol, or a generic yfinance entry."""
    s = symbol.upper()
    if s in ALL_ASSETS:
        return ALL_ASSETS[s]
    # Open search fallback — treat as stock ticker via yfinance
    return {"name": s, "ticker": s, "type": "stock", "sector": "Unknown"}


def get_yfinance_ticker(symbol: str) -> str:
    info = get_asset(symbol)
    return info.get("ticker", symbol.upper())


def is_crypto(symbol: str) -> bool:
    s = symbol.upper()
    return ALL_ASSETS.get(s, {}).get("type") == "crypto"


def has_nhits(symbol: str) -> bool:
    return symbol.upper() in NHITS_FEATURED


TFT_FEATURED = NHITS_FEATURED


def has_tft(symbol: str) -> bool:
    return symbol.upper() in TFT_FEATURED


# Backward-compatible aliases for existing import paths.
LSTM_FEATURED = NHITS_FEATURED


def has_lstm(symbol: str) -> bool:
    return has_nhits(symbol)


def list_crypto() -> list:
    return [{"symbol": k, **v} for k, v in CRYPTO_ASSETS.items()]


def list_stocks() -> list:
    return [{"symbol": k, **v} for k, v in STOCK_ASSETS.items()]
