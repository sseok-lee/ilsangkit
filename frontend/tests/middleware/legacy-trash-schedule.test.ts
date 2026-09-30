import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
const navigateToMock = vi.fn()
const createErrorMock = vi.fn((opts: { statusCode: number; statusMessage: string }) => Object.assign(new Error(opts.statusMessage), opts))

vi.stubGlobal('$fetch', fetchMock)
vi.stubGlobal('navigateTo', navigateToMock)
vi.stubGlobal('createError', createErrorMock)
vi.stubGlobal('useApiBase', () => '/proxy')

describe('legacy-trash-schedule middleware', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigateToMock.mockReset()
    createErrorMock.mockClear()
  })

  async function run(query: Record<string, unknown>, route: Record<string, unknown> = {}) {
    const middleware = (await import('~/middleware/legacy-trash-schedule')).default
    return middleware({
      path: '/trash',
      fullPath: '/trash?schedule=6567&city=서울특별시&district=강남구',
      params: { category: 'trash' },
      query,
      ...route,
    } as never, {} as never)
  }

  it('ignores routes without schedule query', async () => {
    await expect(run({ city: '서울특별시' })).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignores schedule query on non-trash category routes', async () => {
    await expect(run(
      { schedule: '6567' },
      {
        path: '/parking',
        fullPath: '/parking?schedule=6567',
        params: { category: 'parking' },
      }
    )).resolves.toBeUndefined()
    await expect(run(
      { schedule: '6567' },
      {
        path: '/seoul/gangnam/parking',
        fullPath: '/seoul/gangnam/parking?schedule=6567',
        params: { city: 'seoul', district: 'gangnam', category: 'parking' },
      }
    )).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(navigateToMock).not.toHaveBeenCalled()
  })

  it('validates the actual source before redirecting and strips schedule from #from', async () => {
    fetchMock.mockResolvedValue({ success: true, data: { id: 6567 } })

    await run({ schedule: '6567', city: '서울특별시', district: '강남구', bad: 'x' })

    expect(fetchMock).toHaveBeenCalledWith('/proxy/api/waste-schedules/6567')
    expect(navigateToMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/trash\/6567#from=/),
      expect.objectContaining({})
    )
    const target = navigateToMock.mock.calls[0][0] as string
    const from = decodeURIComponent(target.split('#from=')[1])
    expect(from).toBe('/trash?city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&district=%EA%B0%95%EB%82%A8%EA%B5%AC')
    expect(decodeURIComponent(target)).not.toContain('schedule=')
    expect(decodeURIComponent(target)).not.toContain('bad=')
  })

  it('maps invalid source ids to 400 before fetch', async () => {
    await expect(run({ schedule: 'abc' })).rejects.toMatchObject({ statusCode: 400 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps backend status distinctions', async () => {
    fetchMock.mockRejectedValueOnce({ statusCode: 404 })
    await expect(run({ schedule: '6567' })).rejects.toMatchObject({ statusCode: 404 })

    fetchMock.mockRejectedValueOnce({ statusCode: 410 })
    await expect(run({ schedule: '6567' })).rejects.toMatchObject({ statusCode: 410 })

    fetchMock.mockRejectedValueOnce({ statusCode: 503 })
    await expect(run({ schedule: '6567' })).rejects.toMatchObject({ statusCode: 503 })
  })
})
