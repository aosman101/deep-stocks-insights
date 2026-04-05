/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Deep Stock Insights brand palette — dark finance theme
        surface: {
          DEFAULT: '#0f1117',
          card:    '#161b27',
          hover:   '#1e2538',
          border:  '#2a3347',
        },
        accent: {
          blue:   '#3b82f6',
          cyan:   '#06b6d4',
          green:  '#22c55e',
          red:    '#ef4444',
          amber:  '#f59e0b',
          purple: '#a855f7',
        },
        btc:  '#f7931a',
        gold: '#fbbf24',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':     'fadeIn 0.3s ease-in-out',
        'slide-up':    'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
