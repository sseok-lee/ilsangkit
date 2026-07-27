// rss.xml.ts(가이드 피드 라우트) 테스트.
// 파일명이 rss.test.ts 가 아닌 이유: 그쪽은 generateRssXml 순수함수 전용이고,
// 이 파일은 vi.mock 으로 h3·ssrFetch 를 갈아끼우므로 분리한다.
// 시나리오는 article-rss.test.ts 와 일부러 1:1 대칭으로 맞춰, 두 피드의 계약 차이가
// 테스트 차이로 드러나게 한다.
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('h3', () => ({
  defineEventHandler: (fn: any) => fn,
  setResponseHeader: (event: any, k: string, v: string) => event.__headers.set(k, v),
}))

vi.mock('../../server/utils/ssrFetch', () => ({
  ssrFetch: vi.fn(),
}))

import { ssrFetch } from '../../server/utils/ssrFetch'

function mockEvent() {
  return { __headers: new Map<string, string>() } as any
}

describe('rss.xml route handler', () => {
  beforeEach(() => {
    vi.mocked(ssrFetch).mockReset()
    vi.resetModules()
  })

  it('발행 guide를 "생활 가이드" 전용 채널 RSS로 직렬화한다', async () => {
    vi.mocked(ssrFetch).mockResolvedValue({
      data: {
        items: [
          { title: '생활 가이드 1', slug: 'guide-1', summary: '요약1', createdAt: '2026-07-05T14:55:02.000Z' },
        ],
      },
    })

    const { default: handler } = await import('../../server/routes/rss.xml')
    const event = mockEvent()
    const xml = (await handler(event)) as string

    expect(xml).toContain('<title>일상킷 - 생활 가이드</title>')
    expect(xml).toContain('<link>https://ilsangkit.co.kr/guide</link>')
    expect(xml).toContain('<link>https://ilsangkit.co.kr/guide/guide-1</link>')
    expect(xml).toContain('생활 가이드 1')
    expect(event.__headers.get('Content-Type')).toContain('application/xml')
    expect(event.__headers.get('Cache-Control')).toContain('s-maxage=3600')
  })

  it('가이드 목록 API를 limit=50으로 호출한다', async () => {
    vi.mocked(ssrFetch).mockResolvedValue({ data: { items: [] } })

    const { default: handler } = await import('../../server/routes/rss.xml')
    await handler(mockEvent())

    expect(ssrFetch).toHaveBeenCalledTimes(1)
    expect(vi.mocked(ssrFetch).mock.calls[0][0]).toBe('/api/guides?limit=50')
  })

  it('atom:link rel="self"가 아티클 피드가 아닌 rss.xml 자신을 가리켜야 한다', async () => {
    vi.mocked(ssrFetch).mockResolvedValue({ data: { items: [] } })

    const { default: handler } = await import('../../server/routes/rss.xml')
    const xml = (await handler(mockEvent())) as string

    expect(xml).toContain('<atom:link href="https://ilsangkit.co.kr/rss.xml" rel="self" type="application/rss+xml" />')
    expect(xml).not.toContain('href="https://ilsangkit.co.kr/article-rss.xml"')
  })

  it('summary가 없으면 title로 description을 대체한다', async () => {
    vi.mocked(ssrFetch).mockResolvedValue({
      data: {
        items: [
          { title: '요약 없는 가이드', slug: 'guide-2', summary: null, createdAt: '2026-07-05T14:55:02.000Z' },
        ],
      },
    })

    const { default: handler } = await import('../../server/routes/rss.xml')
    const xml = (await handler(mockEvent())) as string

    expect(xml).toContain('요약 없는 가이드')
  })

  it('ssrFetch 실패 시 같은 채널 정보의 빈 피드로 폴백한다 (크래시 없음)', async () => {
    vi.mocked(ssrFetch).mockRejectedValue(new Error('backend down'))

    const { default: handler } = await import('../../server/routes/rss.xml')
    const xml = (await handler(mockEvent())) as string

    expect(xml).toContain('<title>일상킷 - 생활 가이드</title>')
    expect(xml).toContain('<link>https://ilsangkit.co.kr/guide</link>')
    expect(xml).not.toContain('<item>')
    expect(xml).toContain('<atom:link href="https://ilsangkit.co.kr/rss.xml" rel="self" type="application/rss+xml" />')
  })

  // 아래 두 개는 catch 폴백이 아니라 "성공 경로에서 조용히 빈 피드가 되는" 방어 분기다.
  // 이쪽은 s-maxage=3600 이 붙은 채로 캐시되므로 catch 경로보다 오히려 위험하다.
  it('응답 형태가 어긋나도(data 누락) 크래시 없이 빈 피드를 만든다', async () => {
    vi.mocked(ssrFetch).mockResolvedValue({} as any)

    const { default: handler } = await import('../../server/routes/rss.xml')
    const event = mockEvent()
    const xml = (await handler(event)) as string

    expect(xml).toContain('<title>일상킷 - 생활 가이드</title>')
    expect(xml).not.toContain('<item>')
    // catch 가 아닌 성공 경로이므로 캐시 헤더가 붙는다 — 이 사실을 고정해 둔다.
    expect(event.__headers.get('Cache-Control')).toContain('s-maxage=3600')
  })

  it('날짜 필드가 없는 항목도 크래시 없이 유효한 피드로 나간다', async () => {
    vi.mocked(ssrFetch).mockResolvedValue({
      data: {
        items: [
          { title: '날짜 없는 가이드', slug: 'guide-3', summary: '요약3' },
        ],
      },
    })

    const { default: handler } = await import('../../server/routes/rss.xml')
    const xml = (await handler(mockEvent())) as string

    expect(xml).toContain('날짜 없는 가이드')
    expect(xml).not.toContain('Invalid Date')
    expect(xml).toContain('</rss>')
  })

  it('아티클 RSS와 별도 채널이다 — "오늘의 이슈" 문자열을 포함하지 않는다', async () => {
    vi.mocked(ssrFetch).mockResolvedValue({ data: { items: [] } })

    const { default: handler } = await import('../../server/routes/rss.xml')
    const xml = (await handler(mockEvent())) as string

    expect(xml).not.toContain('오늘의 이슈')
  })
})
