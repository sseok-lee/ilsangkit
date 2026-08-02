// frontend/tests/nitroCacheBound.test.ts
//
// 회귀 가드: routeRules 의 swr 캐시 저장소는 반드시 크기 상한이 있어야 한다.
//
// 배경(2026-08-02 힙 스냅샷 2회 diff): nitro.storage 에 cache 마운트가 없으면 Nitro 는
// 기본 인메모리 드라이버로 떨어지는데, 그 드라이버는 크기 상한이 없고 만료를 read 시점에만
// 검사한다(백그라운드 청소 없음). 크롤러가 37만 부동산 URL 을 한 번씩만 긁으면 "쓰이고
// 다시 안 읽히는" 엔트리가 영구 잔존한다.
//   실측: 35분간 heapUsed 70→293MB(약 6.4MB/분). 증가분 226MB 중 200MB(88%)가 string,
//         그 92%가 렌더된 SSR HTML 조각. 결과적으로 V8 heap limit 도달 → SIGABRT 로
//         하루 12~24회 하드 크래시.
//
// ⚠️ TTL 단축으로는 해결되지 않는다(만료 검사가 read 시점에만 일어남). 반드시 크기 상한이어야 한다.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend')
const src = readFileSync(resolve(root, 'nuxt.config.ts'), 'utf8')

/** nitro.storage 블록만 잘라낸다 (routeRules 쪽 문자열과 섞이지 않게). */
function storageBlock(): string {
  const i = src.indexOf('storage:')
  expect(i, 'nitro.storage 선언이 없다 — 기본 인메모리 드라이버로 떨어진다').toBeGreaterThan(-1)
  return src.slice(i, i + 400)
}

describe('Nitro swr 캐시 저장소', () => {
  it('cache 마운트가 선언돼 있다', () => {
    expect(storageBlock()).toMatch(/cache:\s*\{/)
  })

  it('크기 상한이 있는 드라이버를 쓴다 (기본 인메모리 금지)', () => {
    expect(storageBlock()).toMatch(/driver:\s*'lruCache'/)
  })

  it('상한 값이 명시돼 있고 합리적 범위다', () => {
    const m = storageBlock().match(/max:\s*(\d+)/)
    expect(m, 'max 가 없으면 lruCache 기본값(1000)에 의존하게 된다').not.toBeNull()
    const max = Number(m![1])
    // 페이지당 약 200KB. 너무 크면 상한의 의미가 없고, 너무 작으면 스래싱만 한다.
    expect(max).toBeGreaterThanOrEqual(100)
    expect(max).toBeLessThanOrEqual(1000)
  })

  it('swr routeRule 이 남아 있는 한 이 상한이 필요하다 (전제 고정)', () => {
    // swr 이 전부 사라졌다면 이 가드의 전제가 바뀐 것이므로 같이 재검토해야 한다.
    expect(src).toMatch(/swr:\s*\d+/)
  })
})
