/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Graphite & Cobalt — layered dark slate + cobalt
        surface: {
          DEFAULT: '#0a0a0b',   // near-black base
          card:    '#18181b',   // raised panel (zinc-900)
          hover:   '#27272a',   // hover / elevated (zinc-800)
          deep:    '#000000',   // deepest well
          border:  '#27272a',   // hairline
          ring:    '#3f3f46',   // ring (zinc-700)
        },
        parchment: {
          DEFAULT: '#e4e4e7',   // primary text (zinc-200)
          dim:     '#d4d4d8',   // dimmed (zinc-300)
          muted:   '#a1a1aa',   // muted (zinc-400)
          faint:   '#71717a',   // faint (zinc-500)
        },
        // Backwards-compat aliases (existing pages use these)
        accent: {
          blue:   '#10b981',    // remapped to emerald for legacy refs
          cyan:   '#06b6d4',    // sky cyan
          green:  '#10b981',    // emerald (bullish)
          red:    '#ef4444',    // rose (bearish)
          amber:  '#f59e0b',    // retained warning gold
          purple: '#8b5cf6',    // accent variety
        },
        ink: {
          DEFAULT: '#e4e4e7',
          dim:     '#d4d4d8',
          muted:   '#a1a1aa',
        },
        ember: {
          50:  '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',       // primary emerald
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        btc:  '#f7931a',
        gold: '#f5a524',
        bull: '#10b981',        // emerald
        bear: '#ef4444',        // rose
      },
      fontFamily: {
        // Editorial display — dramatic at large sizes
        display: ['Fraunces', 'Georgia', 'serif'],
        // Technical body — characterful geometric sans
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Tabular monospace for price data
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        headline: '-0.03em',
      },
      fontSize: {
        // Editorial display scale
        'display-xs': ['2.25rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
        'display-sm': ['3rem',    { lineHeight: '0.95', letterSpacing: '-0.035em' }],
        'display-md': ['4rem',    { lineHeight: '0.9',  letterSpacing: '-0.04em' }],
        'display-lg': ['5.5rem',  { lineHeight: '0.88', letterSpacing: '-0.045em' }],
        'display-xl': ['8rem',    { lineHeight: '0.85', letterSpacing: '-0.05em' }],
      },
      boxShadow: {
        'inset-border': 'inset 0 0 0 1px rgba(255, 255, 255, 0.04)',
        'ember-glow':   '0 0 40px -8px rgba(16, 185, 129, 0.45)',
        'card':         'inset 0 1px 0 0 rgba(255,255,255,0.03), 0 8px 28px -14px rgba(0,0,0,0.75)',
        'card-hover':   'inset 0 1px 0 0 rgba(255,255,255,0.05), 0 20px 50px -18px rgba(16,185,129,0.32)',
      },
      backgroundImage: {
        'grain':        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.04 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        'ember-radial': 'radial-gradient(ellipse 80% 50% at 20% 0%, rgba(16,185,129,0.10), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(16,185,129,0.07), transparent 60%)',
        'scanlines':    'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(255,255,255,0.015) 2px, rgba(255,255,255,0.015) 3px)',
      },
      animation: {
        'pulse-slow':  'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in':     'fadeIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both',
        'rise':        'rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both',
        'rise-slow':   'rise 1s cubic-bezier(0.22, 1, 0.36, 1) both',
        'marquee':     'marquee 60s linear infinite',
        'marquee-rev': 'marquee-rev 80s linear infinite',
        'shimmer':     'shimmer 2.2s ease-in-out infinite',
        'blink':       'blink 1.2s steps(2, start) infinite',
        'ticker-up':   'ticker-up 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        'glow-pulse':  'glow-pulse 3.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        rise: {
          from: { opacity: 0, transform: 'translateY(18px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-50%)' },
        },
        'marquee-rev': {
          from: { transform: 'translateX(-50%)' },
          to:   { transform: 'translateX(0)' },
        },
        shimmer: {
          '0%, 100%': { opacity: 0.5 },
          '50%':      { opacity: 1 },
        },
        blink: {
          '50%': { opacity: 0 },
        },
        'ticker-up': {
          from: { transform: 'translateY(8px)', opacity: 0 },
          to:   { transform: 'translateY(0)', opacity: 1 },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: 0.35 },
          '50%':      { opacity: 0.7 },
        },
      },
    },
  },
  plugins: [],
}
