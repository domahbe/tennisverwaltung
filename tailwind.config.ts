import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#007AFF',
          dark: '#0A84FF',
          soft: 'var(--primary-soft)',
        },
        ink: '#1D1D1F',
        paper: '#F5F5F7',
        free: '#34C759',
        soon: '#FF9500',
        busy: '#FF3B30',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Inter',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '20px',
        sheet: '24px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.04)',
        'card-dark': '0 2px 12px rgba(0,0,0,0.4)',
        fab: '0 8px 24px rgba(0,122,255,0.4)',
      },
      animation: {
        shimmer: 'shimmer 1.4s infinite linear',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
