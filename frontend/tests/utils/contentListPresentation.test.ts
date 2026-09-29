import { describe, expect, it } from 'vitest'
import { splitFeatured } from '~/utils/contentListPresentation'

describe('featured list presentation', () => {
  it.each([0, 1, 12])('preserves all %i results exactly once', (count) => {
    const items = Array.from({ length: count }, (_, id) => ({ id }))
    const result = splitFeatured(items, 1, true)
    expect(result.featured).toEqual(items[0] ?? null)
    expect(result.rows).toEqual(items.slice(1))
    expect([...(result.featured ? [result.featured] : []), ...result.rows]).toEqual(items)
  })
  it('does not feature later pages or article lists', () => {
    const items = [{ id: 13 }]
    expect(splitFeatured(items, 2, true)).toEqual({ featured: null, rows: items })
    expect(splitFeatured(items, 1, false)).toEqual({ featured: null, rows: items })
  })
})
