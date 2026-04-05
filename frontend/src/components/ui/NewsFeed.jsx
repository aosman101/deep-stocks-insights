import { useState, useEffect } from 'react'
import { finnhubApi } from '../../services/api'
import { Newspaper, ExternalLink, Clock } from 'lucide-react'

function NewsItem({ article }) {
  const date = article.datetime
    ? new Date(article.datetime * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 px-4 py-3 border-b border-surface-border/50 hover:bg-surface-hover transition-colors group"
    >
      {article.image && (
        <img
          src={article.image}
          alt=""
          className="w-16 h-16 rounded-lg object-cover flex-shrink-0 bg-surface-hover"
          onError={e => { e.target.style.display = 'none' }}
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium leading-snug line-clamp-2 group-hover:text-accent-blue transition-colors">
          {article.headline}
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
          {article.source && <span>{article.source}</span>}
          {date && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {date}
            </span>
          )}
        </div>
        {article.summary && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">{article.summary}</p>
        )}
      </div>
      <ExternalLink className="w-4 h-4 text-gray-600 flex-shrink-0 mt-1 group-hover:text-accent-blue transition-colors" />
    </a>
  )
}

export default function NewsFeed({ category = 'general', maxItems = 8 }) {
  const [news, setNews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState(category)

  const categories = [
    { id: 'general', label: 'General' },
    { id: 'crypto', label: 'Crypto' },
    { id: 'forex', label: 'Forex' },
    { id: 'merger', label: 'M&A' },
  ]

  useEffect(() => {
    setLoading(true)
    setError('')
    finnhubApi.marketNews(activeCategory)
      .then(r => {
        const articles = Array.isArray(r.data) ? r.data.slice(0, maxItems) : []
        setNews(articles)
      })
      .catch(e => {
        const detail = e.response?.data?.detail ?? ''
        if (e.response?.status === 503 || detail.includes('not configured')) {
          setError('News feed requires a Finnhub API key. Add FINNHUB_API_KEY to your .env file.')
        } else {
          setError('Failed to load news')
        }
      })
      .finally(() => setLoading(false))
  }, [activeCategory, maxItems])

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-accent-blue" />
          Market News
        </h2>
        <div className="flex items-center gap-1">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-accent-blue text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-accent-blue/30 border-t-accent-blue rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="px-4 py-8 text-center">
          <Newspaper className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">{error}</p>
        </div>
      )}

      {!loading && !error && news.length === 0 && (
        <div className="px-4 py-8 text-center text-xs text-gray-500">
          No news articles available for this category.
        </div>
      )}

      {!loading && !error && news.length > 0 && (
        <div>
          {news.map((article, i) => (
            <NewsItem key={article.id ?? i} article={article} />
          ))}
        </div>
      )}
    </div>
  )
}
