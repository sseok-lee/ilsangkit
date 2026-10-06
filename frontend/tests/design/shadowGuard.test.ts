import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve, relative, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindConfig from '../../tailwind.config.js'

// 사이트 전체 box-shadow 0(스펙 2026-10-02 §3). 떠 있는 층의 shadow-card-2 만 허용(§7.3).
// 그 밖의 그림자는 아래 ALLOW 에 사유와 함께 적어야 한다.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const SCAN_DIRS = ['pages', 'components', 'layouts', 'composables', 'utils']
const SCAN_FILES = ['app.vue', 'error.vue', 'assets/css/main.css']

// git 무시 대상인 로컬 전용 개발 데모 — CI 에는 없으므로 로컬·CI 스캔 대상을 맞추려고 제외
const IGNORED = new Set(['pages/msw-demo.vue'])

const ALLOW: Array<{ file: string; token: string; reason: string }> = [
  { file: 'components/realEstate/map/MapBottomSheet.vue', token: 'shadow-[0_-4px_16px_rgba(0,0,0,0.12)]', reason: '지도 위 바닥 시트 — 위쪽으로 드리워야 경계가 보임' },
  { file: 'composables/useKakaoMap.ts', token: 'shadow-md', reason: '지도 내부 마커 알약' },
  { file: 'components/map/FacilityMap.vue', token: 'box-shadow: 0 1px 4px rgb(0 0 0 / 0.2)', reason: '지도 내부 현재 위치 점' },
  { file: 'assets/css/main.css', token: 'shadow-[0_1px_3px_rgba(21,33,59,0.18)]', reason: '지도 내부 가격 라벨·지역 버블' },
  { file: 'assets/css/main.css', token: 'shadow-[0_3px_10px_rgba(21,33,59,0.16)]', reason: '지도 내부 펼침 카드' },
  { file: 'pages/search.vue', token: 'box-shadow: 0 0 0 2px rgb(36 80 220 / 12%)', reason: '포커스 링(:focus-within)' },
]

function walk(dir: string): string[] {
  const abs = resolve(root, dir)
  return readdirSync(abs).flatMap((name) => {
    const p = join(abs, name)
    if (statSync(p).isDirectory()) return walk(relative(root, p))
    const rel = relative(root, p)
    if (IGNORED.has(rel)) return []
    return /\.(vue|ts|css)$/.test(name) ? [rel] : []
  })
}

function stripComments(src: string): string {
  return src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

// Tailwind 유틸: 공백·따옴표·백틱 뒤에서 시작하는 [변형:]*shadow[-값]
const UTIL = /(?<=^|[\s"'`])((?:[\w-]+:)*shadow(?:-[^\s"'`;]+)?)(?=[\s"'`;]|$)/gm
// CSS 선언
const DECL = /box-shadow:\s*([^;}]+)/g

function offenders(file: string): string[] {
  const src = stripComments(readFileSync(resolve(root, file), 'utf8'))
  const found: string[] = []
  for (const m of src.matchAll(UTIL)) {
    const base = m[1].split(':').pop()!
    if (base === 'shadow-card-2' || base === 'shadow-none') continue
    found.push(base)
  }
  for (const m of src.matchAll(DECL)) {
    const value = m[1].trim()
    if (value === 'none') continue
    found.push(`box-shadow: ${value}`)
  }
  return found.filter((token) => !ALLOW.some((a) => a.file === file && a.token === token))
}

const FILES = [...SCAN_DIRS.flatMap(walk), ...SCAN_FILES]

describe('사이트 전체 그림자 가드', () => {
  it('스캔 대상이 충분히 크다(경로 실수 방지)', () => {
    expect(FILES.length).toBeGreaterThan(200)
  })

  it('예외 목록 밖 그림자 0', () => {
    const bad = FILES.flatMap((f) => offenders(f).map((t) => `${f}: ${t}`))
    expect(bad).toEqual([])
  })

  it('예외 목록의 항목은 실제로 존재한다(죽은 예외 금지)', () => {
    for (const a of ALLOW) {
      expect(readFileSync(resolve(root, a.file), 'utf8'), `${a.file} — ${a.token}`).toContain(a.token)
    }
  })

  it('Tailwind boxShadow 토큰은 card-2 하나', () => {
    expect(Object.keys(tailwindConfig.theme.extend.boxShadow)).toEqual(['card-2'])
  })
})
