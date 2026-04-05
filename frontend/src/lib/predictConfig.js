export const DEFAULT_PREDICT_ASSET = 'BTC'

export const LSTM_FEATURED_SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'ADA', 'DOGE', 'AVAX',
  'GOLD', 'SILVER',
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA',
]

export const LSTM_FEATURED_SET = new Set(LSTM_FEATURED_SYMBOLS)

export function supportsLstm(symbol = '') {
  return LSTM_FEATURED_SET.has(symbol.toUpperCase())
}
