import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSearchSuggest } from '~/composables/useSearchSuggest'

const fetchSpy = vi.fn(async () => ({ success: true, data: { items: [] } }))
beforeEach(() => { fetchSpy.mockClear(); vi.stubGlobal('$fetch', fetchSpy) })

describe('useSearchSuggest scope', () => {
  it('suggest(q, scope) 는 /api/search/suggest 에 scope 파라미터를 넣는다', async () => {
    const { suggest } = useSearchSuggest()
    suggest('강남', 'facility:toilet')
    await new Promise((r) => setTimeout(r, 250)) // debounce(200ms) 통과
    const call = fetchSpy.mock.calls.find((c) => String(c[0]).includes('/api/search/suggest'))
    expect((call![1] as { params: { scope?: string } }).params.scope).toBe('facility:toilet')
  })

  it('scope 미지정 시 params 에 scope 키가 없다(하위호환)', async () => {
    const { suggest } = useSearchSuggest()
    suggest('강남')
    await new Promise((r) => setTimeout(r, 250))
    const call = fetchSpy.mock.calls.find((c) => String(c[0]).includes('/api/search/suggest'))
    expect((call![1] as { params: { scope?: string } }).params.scope).toBeUndefined()
  })
})
