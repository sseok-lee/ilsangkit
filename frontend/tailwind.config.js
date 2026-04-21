import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{vue,js,ts}',
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.{vue,js,ts}',
    './pages/**/*.{vue,js,ts}',
    './plugins/**/*.{js,ts}'
  ],
  theme: {
    extend: {
      colors: {
        // Primary color (Stitch 디자인 시스템)
        primary: {
          DEFAULT: '#2563eb',
          dark: '#1d4ed8',
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3c83f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Secondary color
        secondary: '#8b5cf6',
        // Background colors (Stitch 디자인 시스템)
        'background-light': '#f9fafb',
        // Surface colors (Stitch 디자인 시스템)
        'surface-light': '#ffffff',
        // Category accent color (purple for toilet)
        'accent-purple': '#8b5cf6',
        // Category colors
        toilet: '#8b5cf6',
        trash: '#10b981',
        wifi: '#f59e0b',
        clothes: '#ec4899',
        battery: '#06b6d4',
        kiosk: '#6366f1',
        // Semantic colors
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
        // Wireframe card border
        line: '#d8e0ea',
      },
      fontFamily: {
        display: ['Public Sans', 'Noto Sans KR', 'sans-serif'],
        sans: [
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'system-ui',
          'Roboto',
          'Helvetica Neue',
          'Segoe UI',
          'Apple SD Gothic Neo',
          'Noto Sans KR',
          'Malgun Gothic',
          'sans-serif'
        ],
      },
      spacing: {
        '128': '32rem',
        '144': '36rem',
      },
      borderRadius: {
        'DEFAULT': '0.5rem',
        'lg': '0.5rem',
        'xl': '0.5rem',
        '2xl': '0.5rem',
        'full': '9999px',
      },
      boxShadow: {
        'subtle': '0 2px 10px rgba(0, 0, 0, 0.03)',
        'card': '0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(15, 23, 42, 0.04)',
      },
    },
  },
  plugins: [
    typography,
  ],
}
