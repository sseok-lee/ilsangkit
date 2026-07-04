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

describe('article-rss.xml route handler', () => {
  beforeEach(() => {
    vi.mocked(ssrFetch).mockReset()
    vi.resetModules()
  })

  it('발행 article을 "오늘의 이슈" 전용 채널 RSS로 직렬화한다', async () => {
    vi.mocked(ssrFetch).mockResolvedValue({
      data: {
        items: [
          { title: '오늘의 이슈 1', slug: 'issue-1', summary: '요약1', publishedAt: '2026-07-01T09:00:00.000Z' },
        ],
      },
    })

    const { default: handler } = await import('../../server/routes/article-rss.xml')
    const event = mockEvent()
    const xml = (await handler(event)) as string

    expect(xml).toContain('<title>일상킷 - 오늘의 이슈</title>')
    expect(xml).toContain('<link>https://ilsangkit.co.kr/article</link>')
    expect(xml).toContain('<link>https://ilsangkit.co.kr/article/issue-1</link>')
    expect(xml).toContain('오늘의 이슈 1')
    expect(event.__headers.get('Content-Type')).toContain('application/xml')
    expect(event.__headers.get('Cache-Control')).toContain('s-maxage=3600')
  })

  it('summary가 없으면 title로 description을 대체한다', async () => {
    vi.mocked(ssrFetch).mockResolvedValue({
      data: {
        items: [
          { title: '요약 없는 이슈', slug: 'issue-2', summary: null, publishedAt: '2026-07-01T09:00:00.000Z' },
        ],
      },
    })

    const { default: handler } = await import('../../server/routes/article-rss.xml')
    const xml = (await handler(mockEvent())) as string

    expect(xml).toContain('요약 없는 이슈')
  })

  it('ssrFetch 실패 시 같은 채널 정보의 빈 피드로 폴백한다 (크래시 없음)', async () => {
    vi.mocked(ssrFetch).mockRejectedValue(new Error('backend down'))

    const { default: handler } = await import('../../server/routes/article-rss.xml')
    const xml = (await handler(mockEvent())) as string

    expect(xml).toContain('<title>일상킷 - 오늘의 이슈</title>')
    expect(xml).toContain('<link>https://ilsangkit.co.kr/article</link>')
    expect(xml).not.toContain('<item>')
  })

  it('가이드 RSS와 별도 채널이다 — "생활 가이드" 문자열을 포함하지 않는다', async () => {
    vi.mocked(ssrFetch).mockResolvedValue({ data: { items: [] } })

    const { default: handler } = await import('../../server/routes/article-rss.xml')
    const xml = (await handler(mockEvent())) as string

    expect(xml).not.toContain('생활 가이드')
  })
})
