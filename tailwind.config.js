/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ose: {
          bg: '#060c18',
          surface: '#0b1525',
          elevated: '#101e35',
          border: '#1a2d4a',
          borderLit: '#2a4d7a',
          cyan: '#00c8ff',
          cyanDim: '#007899',
          green: '#00e87a',
          greenDim: '#009950',
          amber: '#ffb020',
          red: '#ff4040',
          text: '#d0e8ff',
          textSub: '#6a8cb0',
          textMuted: '#3a5878',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-cyan': 'pulse-cyan 2s cubic-bezier(0.4,0,0.6,1) infinite',
        'fade-in-up': 'fade-in-up 0.3s ease-out',
        'slide-in': 'slide-in 0.3s ease-out',
      },
      keyframes: {
        'pulse-cyan': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
