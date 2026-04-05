import axios from 'axios'

const DEFAULT_TIMEOUT = 15_000
const LONG_TIMEOUT = 60_000
const TRAINING_TIMEOUT = 120_000

const api = axios.create({ baseURL: '/', timeout: DEFAULT_TIMEOUT })

// Auto-logout on 401
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('dsi_token')
      delete api.defaults.headers.common['Authorization']
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Response cache (deduplicates rapid/repeated GET requests) ──
const _cache = new Map()
const CACHE_TTL = 30_000 // 30 seconds

function cachedGet(url, config) {
  const key = url + (config?.params ? JSON.stringify(config.params) : '')
  const entry = _cache.get(key)
  if (entry && Date.now() < entry.expiry) return Promise.resolve(entry.data)

  // Deduplicate in-flight requests to the same key
  if (entry?.pending) return entry.pending

  const pending = api.get(url, config).then(res => {
    _cache.set(key, { data: res, expiry: Date.now() + CACHE_TTL })
    return res
  }).catch(err => {
    _cache.delete(key)
    throw err
  })

  _cache.set(key, { pending })
  return pending
}

export default api

// ── Market ──────────────────────────────────────────────────
export const marketApi = {
  getLiveQuote:   (asset)           => cachedGet(`/api/market/quote/${asset}`),
  getQuotes:      (assets = [])     => cachedGet('/api/market/quotes', {
    params: assets.length ? { assets: assets.join(',') } : undefined,
  }),
  getHistorical:  (asset, p, i)     => cachedGet(`/api/market/history/${asset}`, { params: { period: p, interval: i } }),
  getIndicators:  (asset, p)        => cachedGet(`/api/market/indicators/${asset}`, { params: { period: p } }),
  getRiskLevels:  (asset, sig)      => cachedGet(`/api/market/risk/${asset}`, { params: { signal: sig } }),
  getPositionSize:(params)          => cachedGet('/api/market/position-size', { params }),
}

// ── Predictions ──────────────────────────────────────────────
export const predictionsApi = {
  predict:        (asset, h)        => api.get(`/api/predictions/${asset}`, { params: { horizon: h }, timeout: LONG_TIMEOUT }),
  getMultiHorizon:(asset)           => cachedGet(`/api/predictions/${asset}/multi`, { timeout: LONG_TIMEOUT }),
  getHistory:     (asset, limit)    => cachedGet(`/api/predictions/${asset}/history`, { params: { limit } }),
  getPerformance: (asset)           => cachedGet(`/api/predictions/performance/${asset}`),
}

// ── Analytics ────────────────────────────────────────────────
export const analyticsApi = {
  getEstimate:    (asset)           => cachedGet(`/api/analytics/${asset}`),
  getMonteCarlo:  (asset, n, d)     => cachedGet(`/api/analytics/${asset}/mc`, { params: { n_simulations: n, horizon_days: d }, timeout: LONG_TIMEOUT }),
  getComparison:  (asset)           => cachedGet(`/api/analytics/${asset}/compare`),
  backtest:       (asset, p)        => cachedGet(`/api/analytics/${asset}/backtest`, { params: { period: p }, timeout: LONG_TIMEOUT }),
  getAccuracy:    (asset, p)        => cachedGet(`/api/analytics/${asset}/accuracy`, { params: { period: p }, timeout: LONG_TIMEOUT }),
}

// ── Macro ─────────────────────────────────────────────────────
export const macroApi = {
  getSummary:     ()                => cachedGet('/api/macro/snapshot'),
  getFearGreed:   (limit)           => cachedGet('/api/macro/fear-greed', { params: { limit } }),
  getSeries:      ()                => cachedGet('/api/macro/series'),
  getHistory:     (name, limit)     => cachedGet(`/api/macro/history/${name}`, { params: { limit } }),
}

// ── Scanner / LightGBM ────────────────────────────────────────
export const scannerApi = {
  run:            (assetType, topN) => cachedGet('/api/scanner/run', { params: { asset_type: assetType, top_n: topN }, timeout: LONG_TIMEOUT }),
  runCrypto:      ()                => cachedGet('/api/scanner/crypto'),
  runStocks:      ()                => cachedGet('/api/scanner/stocks'),
  predict:        (symbol)          => cachedGet(`/api/scanner/predict/${symbol}`, { timeout: LONG_TIMEOUT }),
  trainSymbol:    (symbol)          => api.post(`/api/scanner/train/${symbol}`, null, { timeout: TRAINING_TIMEOUT }),
  trainAll:       (assetType)       => api.post('/api/scanner/train-all', null, { params: { asset_type: assetType }, timeout: TRAINING_TIMEOUT }),
  getAssets:      ()                => cachedGet('/api/scanner/assets'),
  getCryptoAssets:()                => cachedGet('/api/scanner/assets/crypto'),
  getStockAssets: ()                => cachedGet('/api/scanner/assets/stocks'),
}

// ── Profile ──────────────────────────────────────────────────
export const profileApi = {
  getMe:          ()               => api.get('/api/auth/me'),
  updateProfile:  (data)           => api.patch('/api/auth/me', data),
  changePassword: (data)           => api.post('/api/auth/me/password', data),
}

// ── Finnhub News ─────────────────────────────────────────────
export const finnhubApi = {
  marketNews:     (cat)            => cachedGet('/api/finnhub/news', { params: { category: cat ?? 'general' } }),
  companyNews:    (symbol, days)   => cachedGet(`/api/finnhub/news/${symbol}`, { params: { days } }),
  sentiment:      (symbol)         => cachedGet(`/api/finnhub/sentiment/${symbol}`),
  profile:        (symbol)         => cachedGet(`/api/finnhub/profile/${symbol}`),
}

// ── Admin ────────────────────────────────────────────────────
export const adminApi = {
  getUsers:       (skip, limit)     => api.get('/api/admin/users', { params: { skip, limit } }),
  createUser:     (data)            => api.post('/api/admin/users', data),
  updateUser:     (id, data)        => api.patch(`/api/admin/users/${id}`, data),
  deleteUser:     (id)              => api.delete(`/api/admin/users/${id}`),
  trainModel:     (asset, data)     => api.post(`/api/admin/train/${asset}`, data, { timeout: TRAINING_TIMEOUT }),
  getModelStatus: ()                => api.get('/api/admin/model-status'),
  getSystemStats: ()                => api.get('/api/admin/system-stats'),
}
