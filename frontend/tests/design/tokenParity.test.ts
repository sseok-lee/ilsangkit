import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import config from '~/tailwind.config.js'

const here = dirname(fileURLToPath(import.meta.url))

const css = readFileSync(resolve(here, '../../', 'assets/css/main.css'), 'utf8')

function cssVar(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!m) throw new Error(`--${name} 미정의`)
  return m[1].trim()
}

function hexToChannels(hex: string): string {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ')
}

// Tailwind 경로 → [CSS 변수 이름, 배선 전 원래 hex]. 원래 hex 가 바뀌면 화면이 바뀐 것이다.
const WIRED: Record<string, [string, string]> = {
  'primary.DEFAULT': ['brand', '#2450DC'],
  'primary.dark': ['brand-strong', '#1A3CB0'],
  'primary.press': ['brand-press', '#16358F'],
  'primary.ink': ['brand-ink', '#0F2C8C'],
  'primary.50': ['brand-tint', '#EBF0FE'],
  'primary.100': ['brand-tint-2', '#DCE6FD'],
  'primary.600': ['brand', '#2450DC'],
  'primary.700': ['brand-strong', '#1A3CB0'],
  'background-light': ['paper', '#F7F8FA'],
  'surface-light': ['surface', '#FFFFFF'],
  'surface-2': ['surface-2', '#FBFCFE'],
  ink: ['ink', '#15213B'],
  strong: ['strong', '#0C1424'],
  muted: ['muted', '#56627A'],
  faint: ['faint', '#677087'],
  line: ['border', '#E6E9F0'],
  'line-2': ['border-2', '#D7DCE7'],
  success: ['success', '#0F7A4C'],
  warning: ['warning', '#E8920C'],
  error: ['danger', '#E0443B'],
  info: ['brand', '#2450DC'],
  'delta-up': ['delta-up', '#DC2626'],
  'delta-down': ['delta-down', '#2563EB'],
  hospital: ['c-hospital', '#3B82F6'],
  pharmacy: ['c-pharmacy', '#14B8A6'],
  parking: ['c-parking', '#0EA5E9'],
  'ev-charger': ['c-ev-charger', '#06B6D4'],
  subway: ['c-subway', '#64748B'],
  school: ['c-school', '#6366F1'],
  childcare: ['c-childcare', '#EC6AA5'],
  toilet: ['c-toilet', '#7C4DEC'],
  trash: ['c-trash', '#0FA968'],
  wifi: ['c-wifi', '#E8920C'],
  clothes: ['c-clothes', '#E2548E'],
  aed: ['c-aed', '#E0443B'],
  library: ['c-library', '#D9820B'],
  park: ['c-park', '#22A95B'],
  market: ['c-market', '#F2730C'],
  sports: ['c-sports', '#8B5CF6'],
}

function configColor(path: string): string {
  const colors = (config as any).theme.extend.colors
  const [head, tail] = path.split('.')
  return tail ? colors[head][tail] : colors[head]
}

describe('토큰 단일 출처', () => {
  for (const [path, [varName, originalHex]] of Object.entries(WIRED)) {
    it(`${path} → --${varName}-rgb 배선, 값 불변(${originalHex})`, () => {
      expect(configColor(path)).toBe(`rgb(var(--${varName}-rgb) / <alpha-value>)`)
      expect(cssVar(varName).toUpperCase()).toBe(originalHex)
      expect(cssVar(`${varName}-rgb`)).toBe(hexToChannels(originalHex))
    })
  }

  it('평면형 보조 토큰 3개가 hex 와 채널로 정의돼 있다', () => {
    for (const [name, hex] of [['track', '#EEF1F5'], ['line-strong', '#DFE4ED'], ['brand-line', '#C9D6FB']]) {
      expect(cssVar(name).toUpperCase()).toBe(hex)
      expect(cssVar(`${name}-rgb`)).toBe(hexToChannels(hex))
    }
  })
})
