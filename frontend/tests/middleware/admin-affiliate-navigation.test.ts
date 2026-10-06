import { afterEach, describe, expect, it, vi } from 'vitest'
import adminDocumentBoundary from '~/middleware/adminDocumentBoundary.global'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('admin document boundary middleware', () => {
  it('does nothing on initial hydration', () => {
    const navigateToMock = vi.fn()
    vi.stubGlobal('navigateTo', navigateToMock)

    const result = (adminDocumentBoundary as unknown as (to: unknown, from: unknown) => unknown)(
      { path: '/admin', fullPath: '/admin', matched: [{}] },
      { path: '/', fullPath: '/', matched: [] }
    )

    expect(result).toBeUndefined()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('does not reload inside the same public or admin boundary', () => {
    const navigateToMock = vi.fn()
    vi.stubGlobal('navigateTo', navigateToMock)

    expect((adminDocumentBoundary as unknown as (to: unknown, from: unknown) => unknown)(
      { path: '/admin/settings', fullPath: '/admin/settings', matched: [{}] },
      { path: '/admin', fullPath: '/admin', matched: [{}] }
    )).toBeUndefined()
    expect((adminDocumentBoundary as unknown as (to: unknown, from: unknown) => unknown)(
      { path: '/guide/a', fullPath: '/guide/a', matched: [{}] },
      { path: '/', fullPath: '/', matched: [{}] }
    )).toBeUndefined()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('forces document navigation between public and admin routes in both directions', () => {
    const navigateToMock = vi.fn((path, options) => ({ path, options }))
    vi.stubGlobal('navigateTo', navigateToMock)

    const intoAdmin = (adminDocumentBoundary as unknown as (to: unknown, from: unknown) => unknown)(
      { path: '/admin', fullPath: '/admin?from=public', matched: [{}] },
      { path: '/guide/a', fullPath: '/guide/a', matched: [{}] }
    )
    const outOfAdmin = (adminDocumentBoundary as unknown as (to: unknown, from: unknown) => unknown)(
      { path: '/', fullPath: '/?done=1', matched: [{}] },
      { path: '/admin', fullPath: '/admin', matched: [{}] }
    )

    expect(navigateToMock).toHaveBeenNthCalledWith(1, '/admin?from=public', { external: true })
    expect(navigateToMock).toHaveBeenNthCalledWith(2, '/?done=1', { external: true })
    expect(intoAdmin).toEqual({ path: '/admin?from=public', options: { external: true } })
    expect(outOfAdmin).toEqual({ path: '/?done=1', options: { external: true } })
  })
})
