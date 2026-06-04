/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ares: {
          bg:         '#05080f',
          surface:    '#090e1a',
          raised:     '#0d1423',
          elevated:   '#111c30',
          border:     '#162236',
          borderLit:  '#1e3355',
          borderGlow: '#0d4080',

          // Primary accent — amber/gold (command center feel)
          amber:      '#f59e0b',
          amberDim:   '#92600a',
          amberGlow:  '#f59e0b33',

          // Status green
          green:      '#22d3a0',
          greenDim:   '#0f7a5a',
          greenGlow:  '#22d3a033',

          // Alert red
          red:        '#f43f5e',
          redDim:     '#7f1d36',
          redGlow:    '#f43f5e33',

          // Info cyan
          cyan:       '#38bdf8',
          cyanDim:    '#0369a1',
          cyanGlow:   '#38bdf833',

          // Neutral text
          text:       '#e2e8f0',
          textSub:    '#64748b',
          textMuted:  '#334155',
        },
      },
      fontFamily: {
        mono:  ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
        sans:  ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Inter', 'ui-sans-serif'],
      },
      animation: {
        'heartbeat':    'heartbeat 1.4s ease-in-out infinite',
        'scan':         'scan 3s linear infinite',
        'fade-up':      'fade-up 0.25s ease-out',
        'slide-right':  'slide-right 0.25s ease-out',
        'ping-slow':    'ping 2s cubic-bezier(0,0,0.2,1) infinite',
        'blink':        'blink 1.2s step-end infinite',
        'ticker':       'ticker 30s linear infinite',
      },
      keyframes: {
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)',   opacity: '1' },
          '14%':      { transform: 'scale(1.25)', opacity: '1' },
          '28%':      { transform: 'scale(1)',   opacity: '0.9' },
          '42%':      { transform: 'scale(1.2)', opacity: '1' },
          '70%':      { transform: 'scale(1)',   opacity: '1' },
        },
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-right': {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        ticker: {
          '0%':   { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
      backgroundImage: {
        'grid-ares': 'linear-gradient(rgba(14,30,60,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(14,30,60,0.4) 1px, transparent 1px)',
        'scanline':  'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
      },
      backgroundSize: {
        'grid-ares': '40px 40px',
      },
      boxShadow: {
        'glow-amber': '0 0 16px rgba(245,158,11,0.35), 0 0 4px rgba(245,158,11,0.6)',
        'glow-green': '0 0 16px rgba(34,211,160,0.35), 0 0 4px rgba(34,211,160,0.6)',
        'glow-red':   '0 0 16px rgba(244,63,94,0.35),  0 0 4px rgba(244,63,94,0.6)',
        'glow-cyan':  '0 0 16px rgba(56,189,248,0.35), 0 0 4px rgba(56,189,248,0.6)',
        'card':       '0 2px 12px rgba(0,0,0,0.5)',
        'panel':      '0 4px 32px rgba(0,0,0,0.7)',
      },
    },
  },
  plugins: [],
};
