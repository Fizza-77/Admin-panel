/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  safelist: [
    'blog-post-content',
    'w-full',
    'min-w-full',
    'border-collapse',
    'table-auto',
    'my-5',
    'text-sm',
    'leading-normal',
    'border',
    'border-gray-300',
    'bg-gray-100',
    'bg-white',
    'px-3',
    'py-2',
    'text-left',
    'font-semibold',
    'text-gray-900',
    'text-gray-800',
    'align-top',
    'overflow-x-auto',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        premium: {
          bg: '#F8FAFC',
          card: '#FFFFFF',
          primary: '#5B5CEB',
          secondary: '#7C3AED',
          border: '#E5E7EB',
          text: '#111827',
          muted: '#6B7280',
          sidebar: '#111111',
        },
        surface: {
          DEFAULT: 'rgb(var(--background) / <alpha-value>)',
          card: 'rgb(var(--card) / <alpha-value>)',
          muted: 'rgb(var(--muted) / <alpha-value>)',
          border: 'rgb(var(--border) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
        },
        sidebar: {
          DEFAULT: 'rgb(var(--sidebar) / <alpha-value>)',
          foreground: 'rgb(var(--sidebar-foreground) / <alpha-value>)',
        },
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 2px)',
        '2xl': 'calc(var(--radius) + 6px)',
        '3xl': 'calc(var(--radius) + 10px)',
        premium: '18px',
        'premium-lg': '20px',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        glow: '0 0 20px rgb(91 92 235 / 0.15)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s linear infinite',
        'fade-in': 'fade-in 0.35s ease-out',
      },
    },
  },
  plugins: [],
};
