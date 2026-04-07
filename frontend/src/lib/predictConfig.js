export const DEFAULT_PREDICT_ASSET = 'BTC'

export const FEATURED_SEQUENCE_SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'ADA', 'DOGE', 'AVAX',
  'GOLD', 'SILVER', 'GAS', 'OIL', 'DIESEL',
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA',
]

export const FEATURED_SEQUENCE_SET = new Set(FEATURED_SEQUENCE_SYMBOLS)

export const LSTM_FEATURED_SYMBOLS = FEATURED_SEQUENCE_SYMBOLS
export const LSTM_FEATURED_SET = FEATURED_SEQUENCE_SET

export function supportsLstm(symbol = '') {
  return FEATURED_SEQUENCE_SET.has(symbol.toUpperCase())
}

export function supportsSequenceModel(symbol = '') {
  return FEATURED_SEQUENCE_SET.has(symbol.toUpperCase())
}

export function getDefaultModelKeys(symbol = '') {
  const keys = ['lightgbm']
  if (supportsSequenceModel(symbol)) keys.unshift('tft', 'nhits')
  return keys
}
