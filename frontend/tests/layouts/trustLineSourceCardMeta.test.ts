// frontend/tests/layouts/trustLineSourceCardMeta.test.ts
//
// 전역 TrustLine 억제는 route.meta.hasSourceCard 로 판정한다(레이아웃이 SSR 렌더 시점에
// 페이지보다 먼저 평가되므로 provide/inject 카운터로는 늦다 — 이슈 #766).
//
// meta 는 수동 선언이라 DataSourceSection 만 추가하고 meta 를 빠뜨리면 조용히 회귀한다
// (실제로 /auction/list 가 그렇게 누락됐다). 이 테스트가 그 드리프트를 CI 에서 잡는다.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const PAGES_DIR = join(process.cwd(), 'pages')

function walkVueFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walkVueFiles(full))
    else if (entry.name.endsWith('.vue')) out.push(full)
  }
  return out
}

/** 풀카드(비-compact) DataSourceSection 을 렌더하는가 */
function rendersFullSourceCard(source: string): boolean {
  // <DataSourceSection ... > 태그 하나하나를 보고, compact 속성이 없는 게 하나라도 있으면 true
  const tags = source.match(/<DataSourceSection[\s\S]*?\/?>/g) ?? []
  return tags.some((tag) => !/\bcompact\b/.test(tag))
}

function declaresSourceCardMeta(source: string): boolean {
  return /definePageMeta\s*\(\s*\{[\s\S]*?hasSourceCard\s*:\s*true/.test(source)
}

describe('TrustLine 억제 meta 와 DataSourceSection 사용의 정합성', () => {
  const files = walkVueFiles(PAGES_DIR)

  it('페이지 파일을 찾는다(스캐너 자체가 죽지 않았는지)', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('풀카드 DataSourceSection 을 쓰는 페이지는 모두 hasSourceCard meta 를 선언한다', () => {
    const missing = files
      .filter((f) => {
        const src = readFileSync(f, 'utf-8')
        return rendersFullSourceCard(src) && !declaresSourceCardMeta(src)
      })
      .map((f) => relative(PAGES_DIR, f))

    expect(
      missing,
      `DataSourceSection 풀카드가 있는데 definePageMeta({ hasSourceCard: true }) 가 없다.\n` +
        `→ 전역 TrustLine 이 중복 노출된다. 해당 페이지에 meta 를 추가할 것:\n  ${missing.join('\n  ')}`,
    ).toEqual([])
  })

  it('풀카드가 없는 페이지는 hasSourceCard meta 를 선언하지 않는다', () => {
    const stale = files
      .filter((f) => {
        const src = readFileSync(f, 'utf-8')
        return !rendersFullSourceCard(src) && declaresSourceCardMeta(src)
      })
      .map((f) => relative(PAGES_DIR, f))

    expect(
      stale,
      `풀카드 DataSourceSection 이 없는데 hasSourceCard meta 가 남아 있다.\n` +
        `→ TrustLine 이 부당하게 억제돼 출처 안내가 아무것도 안 뜬다:\n  ${stale.join('\n  ')}`,
    ).toEqual([])
  })
})
