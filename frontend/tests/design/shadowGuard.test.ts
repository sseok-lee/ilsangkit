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

const ALLOW: Array<{ file: string; token: string; count: number; reason: string }> = [
  { file: 'components/realEstate/map/MapBottomSheet.vue', token: 'shadow-[0_-4px_16px_rgba(0,0,0,0.12)]', count: 1, reason: '지도 위 바닥 시트 — 위쪽으로 드리워야 경계가 보임' },
  { file: 'composables/useKakaoMap.ts', token: 'shadow-md', count: 1, reason: '지도 내부 마커 알약' },
  { file: 'components/map/FacilityMap.vue', token: 'box-shadow: 0 1px 4px rgb(0 0 0 / 0.2)', count: 1, reason: '지도 내부 현재 위치 점' },
  { file: 'assets/css/main.css', token: 'shadow-[0_1px_3px_rgba(21,33,59,0.18)]', count: 1, reason: '지도 내부 가격 라벨·지역 버블' },
  { file: 'assets/css/main.css', token: 'shadow-[0_3px_10px_rgba(21,33,59,0.16)]', count: 1, reason: '지도 내부 펼침 카드' },
  { file: 'pages/search.vue', token: 'box-shadow: 0 0 0 2px rgb(var(--brand-rgb) / 12%)', count: 1, reason: '포커스 링(:focus-within)' },
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

// 순서 중요: 줄 주석 먼저(그 안의 './utils/**' 같은 글롭이 블록 주석 시작으로 오인되는 것 방지)
export function stripComments(src: string): string {
  return src.replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

// Tailwind 유틸: 공백·따옴표·백틱·{ , 뒤에서 시작하는 [변형:]*[!]shadow[-값]. 종결은 공백·따옴표·; : , } 허용
const UTIL = /(?<=^|[\s"'`{,])((?:[\w-]+:)*!?shadow(?:-(?:\[[^\]\s]*\]|[^\s"'`;,}:\]]+))?)(?=[\s"'`;:,}]|$)/gm
// CSS 선언
const DECL = /box-shadow:\s*([^;}]+)/g

// 허용 토큰(shadow-card-2, shadow-none)을 뺀 그림자 토큰 전부(중복 포함)
export function findShadowTokens(rawSrc: string): string[] {
  const src = stripComments(rawSrc)
  const found: string[] = []
  for (const m of src.matchAll(UTIL)) {
    const base = m[1].split(':').pop()!.replace(/^!/, '')
    if (base === 'shadow-card-2' || base === 'shadow-none') continue
    found.push(base)
  }
  for (const m of src.matchAll(DECL)) {
    const value = m[1].trim()
    if (value === 'none') continue
    found.push(`box-shadow: ${value}`)
  }
  return found
}

function countTokens(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of tokens) map.set(t, (map.get(t) ?? 0) + 1)
  return map
}

function offenders(file: string): string[] {
  const counts = countTokens(findShadowTokens(readFileSync(resolve(root, file), 'utf8')))
  const bad: string[] = []
  for (const [token, n] of counts) {
    const allowed = ALLOW.find((a) => a.file === file && a.token === token)
    if (!allowed) bad.push(...Array<string>(n).fill(token))
    else if (n > allowed.count) bad.push(`${token} (허용 ${allowed.count}개 초과: ${n}개)`)
  }
  return bad
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

  it('예외 목록의 항목은 실제로 존재하며 개수가 정확히 일치한다(죽은 예외 금지)', () => {
    for (const a of ALLOW) {
      const n = countTokens(findShadowTokens(readFileSync(resolve(root, a.file), 'utf8'))).get(a.token) ?? 0
      expect(n, `${a.file} — ${a.token}`).toBe(a.count)
    }
  })

  it('JS 스타일 boxShadow 속성 사용 0', () => {
    const bad = FILES.filter((f) => /boxShadow/.test(stripComments(readFileSync(resolve(root, f), 'utf8'))))
    expect(bad).toEqual([])
  })

  it('stripComments: 줄 주석 속 글롭(/**)이 실제 코드를 삼키지 않는다', () => {
    const out = stripComments("// see './utils/**'\nconst a = 'shadow-md'\n/* x */")
    expect(out).toContain('shadow-md')
    expect(out).not.toContain('x */')
  })

  it('정규식 단위 케이스', () => {
    expect(findShadowTokens('class="!shadow-lg"')).toEqual(['shadow-lg'])
    expect(findShadowTokens('class="hover:!shadow-lg p-2"')).toEqual(['shadow-lg'])
    expect(findShadowTokens('const o = { shadow: x }')).toEqual(['shadow'])
    expect(findShadowTokens('class="transition-shadow ring-1 ring-line"')).toEqual([])
    expect(findShadowTokens('class="shadow-card-2 hover:shadow-card-2 shadow-none"')).toEqual([])
    expect(findShadowTokens('class="shadow-[0_1px_3px_rgba(0,0,0,0.1)]"')).toEqual(['shadow-[0_1px_3px_rgba(0,0,0,0.1)]'])
  })

  it('Tailwind boxShadow 토큰은 card-2 하나', () => {
    expect(Object.keys(tailwindConfig.theme.extend.boxShadow)).toEqual(['card-2'])
  })
})
