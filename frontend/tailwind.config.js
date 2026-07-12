import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{vue,js,ts}',
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.{vue,js,ts}',
    './pages/**/*.{vue,js,ts}',
    './plugins/**/*.{js,ts}',
    './composables/**/*.{js,ts}',
    './utils/**/*.{js,ts}'
  ],
  theme: {
    extend: {
      colors: {
        // Primary color (OD 진화판 — 차분한 코발트로 한 칸 이동)
        primary: {
          DEFAULT: '#2450DC',
          dark: '#1A3CB0',   // brand-strong
          press: '#16358F',  // brand-press
          ink: '#0F2C8C',    // 틴트 위 텍스트
          50:  '#EBF0FE',    // brand-tint
          100: '#DCE6FD',    // brand-tint-2
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3c83f6',
          600: '#2450DC',
          700: '#1A3CB0',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Secondary color
        secondary: '#8b5cf6',
        // Background / surface (OD 진화판 — 시원한 종이 톤)
        'background-light': '#F7F8FA',  // paper
        'surface-light': '#FFFFFF',
        'surface-2': '#FBFCFE',
        // Neutral ink scale (OD)
        ink: '#15213B',
        strong: '#0C1424',
        muted: '#56627A',
        faint: '#677087',
        // Category accent color (purple for toilet)
        'accent-purple': '#8b5cf6',
        // Category colors (OD 16종 정렬 + subway)
        toilet: '#7C4DEC',
        trash: '#0FA968',
        wifi: '#E8920C',
        clothes: '#E2548E',
        hospital: '#3B82F6',
        pharmacy: '#14B8A6',
        parking: '#0EA5E9',
        'ev-charger': '#06B6D4',
        subway: '#64748B',
        school: '#6366F1',
        childcare: '#EC6AA5',
        aed: '#E0443B',
        library: '#D9820B',
        park: '#22A95B',
        market: '#F2730C',
        sports: '#8B5CF6',
        battery: '#06b6d4',
        kiosk: '#6366f1',
        // Semantic colors (OD)
        success: '#0FA968',
        warning: '#E8920C',
        error: '#E0443B',
        info: '#2450DC',
        // 등락(상승/하락) 전용 — main.css --delta-up/--delta-down와 동기화 유지
        'delta-up': '#DC2626',
        'delta-down': '#2563EB',
        // Card border (OD)
        line: '#E6E9F0',
        'line-2': '#D7DCE7',
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
        // OD 진화판 — 2단계 radius (r-sm 10px / r-md 16px)
        'DEFAULT': '0.625rem',  // 10px (r-sm)
        'sm': '0.625rem',       // 10px
        'lg': '0.625rem',       // 10px (r-sm)
        'xl': '1rem',           // 16px (r-md)
        '2xl': '1rem',          // 16px
        'full': '9999px',
      },
      boxShadow: {
        'subtle': '0 2px 10px rgba(0, 0, 0, 0.03)',
        'card': '0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(15, 23, 42, 0.05)',     // sh-1
        'card-2': '0 6px 24px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.06)',  // sh-2
      },
    },
  },
  plugins: [
    typography,
  ],
}
