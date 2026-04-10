/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Editorial Terminal — warm obsidian + parchment + burnt amber
        surface: {
          DEFAULT: '#0b0a08',   // warm obsidian
          card:    '#14110d',   // warm coal
          hover:   '#1c1913',   // raised warm coal
          border:  '#2a241c',   // bronze shadow
          ring:    '#3a3226',   // soft bronze ring
        },
        parchment: {
          DEFAULT: '#f5eeda',   // warm paper
          dim:     '#c9c0a8',   // aged paper
          muted:   '#8c8373',   // dry grass
          faint:   '#57503f',   // faded ink
        },
        // Backwards-compat aliases (existing pages use these)
        accent: {
          blue:   '#f5a524',    // mapped to primary amber (so legacy text-accent-blue still reads)
          cyan:   '#d4a574',    // soft bronze
          green:  '#a3e635',    // lime electric (bullish)
          red:    '#f87171',    // coral (bearish)
          amber:  '#f5a524',    // burnt gold
          purple: '#c084fc',    // kept for accent variety
        },
        ink: {
          DEFAULT: '#f5eeda',
          dim:     '#c9c0a8',
          muted:   '#8c8373',
        },
        ember: {
          50:  '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f59e0b',       // primary burnt amber
          600: '#ea580c',       // vermillion
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        btc:  '#f7931a',
        gold: '#f5a524',
        bull: '#a3e635',        // lime
        bear: '#f87171',        // coral
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
        'inset-border': 'inset 0 0 0 1px rgba(245, 238, 218, 0.08)',
        'ember-glow':   '0 0 40px -8px rgba(245, 165, 36, 0.35)',
        'card':         '0 1px 0 0 rgba(245,238,218,0.04), 0 8px 30px -12px rgba(0,0,0,0.6)',
        'card-hover':   '0 1px 0 0 rgba(245,238,218,0.08), 0 20px 50px -15px rgba(0,0,0,0.75)',
      },
      backgroundImage: {
        'grain':        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0.96 0 0 0 0 0.93 0 0 0 0 0.85 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        'ember-radial': 'radial-gradient(ellipse 80% 50% at 20% 0%, rgba(245,165,36,0.12), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(234,88,12,0.08), transparent 60%)',
        'scanlines':    'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(245,238,218,0.015) 2px, rgba(245,238,218,0.015) 3px)',
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
