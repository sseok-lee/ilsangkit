import typography from '@tailwindcss/typography'

// 색의 단일 출처는 assets/css/main.css :root. 여기서는 채널 변수를 읽기만 한다.
const v = (name) => `rgb(var(--${name}-rgb) / <alpha-value>)`

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
          DEFAULT: v('brand'),
          dark: v('brand-strong'),   // brand-strong
          press: v('brand-press'),  // brand-press
          ink: v('brand-ink'),    // 틴트 위 텍스트
          50:  v('brand-tint'),    // brand-tint
          100: v('brand-tint-2'),    // brand-tint-2
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3c83f6',
          600: v('brand'),
          700: v('brand-strong'),
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Secondary color
        secondary: '#8b5cf6',
        // Background / surface (OD 진화판 — 시원한 종이 톤)
        'background-light': v('paper'),  // paper
        'surface-light': v('surface'),
        'surface-2': v('surface-2'),
        // Neutral ink scale (OD)
        ink: v('ink'),
        strong: v('strong'),
        muted: v('muted'),
        faint: v('faint'),
        // Category accent color (purple for toilet)
        'accent-purple': '#8b5cf6',
        // Category colors (OD 16종 정렬 + subway)
        toilet: v('c-toilet'),
        trash: v('c-trash'),
        wifi: v('c-wifi'),
        clothes: v('c-clothes'),
        hospital: v('c-hospital'),
        pharmacy: v('c-pharmacy'),
        parking: v('c-parking'),
        'ev-charger': v('c-ev-charger'),
        subway: v('c-subway'),
        school: v('c-school'),
        childcare: v('c-childcare'),
        aed: v('c-aed'),
        library: v('c-library'),
        park: v('c-park'),
        market: v('c-market'),
        sports: v('c-sports'),
        battery: '#06b6d4',
        kiosk: '#6366f1',
        // Semantic colors (OD)
        // 전경(글자) 가독성 기준으로 정한 값. 실사용 4곳 중 3곳이 text-success 이고
        // 이전 값 #0FA968 은 green-50 위 2.91:1, 흰 배경 3.05:1 로 AA(4.5:1) 미달이었다.
        // 현재 5.13:1 / 5.37:1. main.css 의 --success 와 값을 맞출 것.
        success: v('success'),
        warning: v('warning'),
        error: v('danger'),
        info: v('brand'),
        // 등락(상승/하락) 전용 — main.css --delta-up/--delta-down와 동기화 유지
        'delta-up': v('delta-up'),
        'delta-down': v('delta-down'),
        // Card border (OD)
        line: v('border'),
        'line-2': v('border-2'),
        // 평면형 보조 토큰(main.css --brand-line/--track/--line-strong 의 이름만 부여, 새 값 아님)
        'brand-line': v('brand-line'),
        track: v('track'),
        'line-strong': v('line-strong'),
      },
      fontFamily: {
        // Public Sans 는 로드되지 않아 폴백으로 떨어진다. Pretendard 를 폴백에 넣어
        // font-display 유틸(66곳)이 시스템 한글 폰트로 튀지 않게 한다.
        display: ['Public Sans', 'Pretendard Variable', 'Pretendard', 'Noto Sans KR', 'sans-serif'],
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
        // 떠 있는 층 전용(스펙 2026-10-02 §7.3). 평면 요소에 그림자를 쓰지 않는다 — tests/design/shadowGuard.test.ts
        'card-2': '0 6px 24px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.06)',  // sh-2
      },
    },
  },
  plugins: [
    typography,
  ],
}
