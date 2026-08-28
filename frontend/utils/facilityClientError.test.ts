import { describe, it, expect } from 'vitest'
import { resolveFacilityClientError } from '~/utils/facilityClientError'

describe('resolveFacilityClientError', () => {
  it('410 은 gone 에러를 띄운다 (404 보다 먼저 판정)', () => {
    expect(resolveFacilityClientError(410)).toEqual({
      statusCode: 410,
      statusMessage: 'Facility permanently removed',
    })
  })

  it('404·422 는 not-found 에러를 띄운다', () => {
    for (const code of [404, 422]) {
      expect(resolveFacilityClientError(code)).toEqual({
        statusCode: 404,
        statusMessage: 'Facility not found',
      })
    }
  })

  it('5xx 는 띄우지 않는다 — 일시 장애를 하드 404 로 굳히지 않는다(fail-open)', () => {
    for (const code of [500, 502, 503, 504]) {
      expect(resolveFacilityClientError(code)).toBeNull()
    }
  })

  it('상태코드가 없으면 띄우지 않는다', () => {
    expect(resolveFacilityClientError(undefined)).toBeNull()
    expect(resolveFacilityClientError()).toBeNull()
  })

  it('SSR 판정(resolveFacilitySsrOutcome)과 상태코드 해석이 어긋나지 않는다', async () => {
    const { resolveFacilitySsrOutcome } = await import('~/utils/facilitySsrOutcome')
    for (const code of [410, 404, 422, 500, 503]) {
      const ssr = resolveFacilitySsrOutcome({
        errorStatusCode: code,
        fetchSettled: false,
        hasData: false,
      })
      const client = resolveFacilityClientError(code)
      if (ssr === 'gone') expect(client?.statusCode).toBe(410)
      else if (ssr === 'not-found') expect(client?.statusCode).toBe(404)
      else expect(client).toBeNull()
    }
  })
})
