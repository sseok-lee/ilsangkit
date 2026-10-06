import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, resolve, relative, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// 사이트 전체 원시 회색 0(스펙 2026-10-02 §3·§8-4). 회색은 토큰(ink·muted·faint·line·background-light)으로만 쓴다.
// 대응표는 scripts/designPaletteCodemod.mjs 가 정본이다.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const SCAN_DIRS = ['pages', 'components', 'layouts', 'composables', 'utils']
const SCAN_FILES = ['app.vue', 'error.vue', 'assets/css/main.css']
// .gitignore 대상(로컬 전용 개발 데모) — CI 와 같은 파일을 보도록 뺀다.
const IGNORED = new Set(['pages/msw-demo.vue'])

export function walk(dir: string): string[] {
  const abs = resolve(root, dir)
  return readdirSync(abs).flatMap((name) => {
    const p = join(abs, name)
    const rel = relative(root, p)
    if (statSync(p).isDirectory()) return walk(rel)
    if (IGNORED.has(rel)) return []
    return /\.(vue|ts|css)$/.test(name) ? [rel] : []
  })
}

export function stripComments(src: string): string {
  return src.replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

export const FILES = [...SCAN_DIRS.flatMap(walk), ...SCAN_FILES]
const read = (f: string) => stripComments(readFileSync(resolve(root, f), 'utf8'))

const RAW_GRAY = /\b(?:text|bg|border(?:-[trblxy])?|divide|ring|from|to|via|fill|stroke|placeholder|outline|decoration)-(?:gray|slate|zinc|neutral|stone)-\d{2,3}\b/g

describe('사이트 전체 원시 회색 가드', () => {
  it('스캔 대상이 충분히 크다(경로 실수 방지)', () => {
    expect(FILES.length).toBeGreaterThan(200)
  })

  it('원시 회색 클래스 0', () => {
    const bad = FILES.flatMap((f) => (read(f).match(RAW_GRAY) ?? []).map((t) => `${f}: ${t}`))
    expect(bad).toEqual([])
  })

  it('RAW_GRAY 는 변형 접두·@apply 를 잡고 prose-slate 는 잡지 않는다', () => {
    expect('hover:text-slate-900'.match(RAW_GRAY)).toEqual(['text-slate-900'])
    expect('@apply bg-slate-100 text-gray-700;'.match(RAW_GRAY)).toEqual(['bg-slate-100', 'text-gray-700'])
    expect('border-t-slate-100'.match(RAW_GRAY)).toEqual(['border-t-slate-100'])
    expect('prose prose-slate max-w-none'.match(RAW_GRAY)).toBeNull()
  })

  it('라이트 전용 — CATEGORY_COLORS 에 dark: 클래스가 없다', () => {
    expect(readFileSync(resolve(root, 'utils/categoryIcons.ts'), 'utf8')).not.toMatch(/bgDark|dark:/)
  })
})

// 토큰과 같은(또는 거의 같은) 중립 hex. main.css 는 토큰 정의 자체라 검사하지 않는다.
// 의미 색(주황·빨강·녹색 등)은 대상이 아니다.
const NEUTRAL_HEX = /#(?:15213b|0c1424|56627a|677087|e6e9f0|d7dce7|2450dc|f7f8fa|fbfcfe|eef1f5|aeb7c8|eef0f4|eef2ff)(?:[0-9a-f]{2})?\b/gi

const HEX_ALLOW: Array<{ file: string; count: number; reason: string }> = [
  { file: 'components/realEstate/DealPriceChart.vue', count: 6, reason: 'canvas strokeStyle/fillStyle 은 CSS 변수를 읽지 못한다' },
]

describe('사이트 전체 중립 hex 가드', () => {
  const HEX_FILES = FILES.filter((f) => f !== 'assets/css/main.css')

  it('예외 목록 밖 중립 hex 0', () => {
    const bad = HEX_FILES.flatMap((f) => {
      const hits = read(f).match(NEUTRAL_HEX) ?? []
      const allow = HEX_ALLOW.find((a) => a.file === f)
      if (allow && hits.length === allow.count) return []
      return hits.map((h) => `${f}: ${h}`)
    })
    expect(bad).toEqual([])
  })

  it('예외 목록의 개수가 실제와 같다(죽은 예외 금지)', () => {
    for (const a of HEX_ALLOW) {
      expect(read(a.file).match(NEUTRAL_HEX)?.length ?? 0, a.file).toBe(a.count)
    }
  })
})
