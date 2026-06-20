import { describe, it, expect, vi, beforeEach } from 'vitest'

const setResponseStatus = vi.fn()
const setResponseHeader = vi.fn()
let mockEvent: unknown = { __isEvent: true }

vi.stubGlobal('useRequestEvent', () => mockEvent)
vi.stubGlobal('setResponseStatus', setResponseStatus)
vi.stubGlobal('setResponseHeader', setResponseHeader)

import { markDegradedResponse } from '~/composables/useDegradedResponse'

describe('markDegradedResponse', () => {
  beforeEach(() => {
    setResponseStatus.mockClear()
    setResponseHeader.mockClear()
    mockEvent = { __isEvent: true }
  })

  it('SSR 이벤트가 있으면 503 + cache-control:no-store 설정', () => {
    markDegradedResponse()
    expect(setResponseStatus).toHaveBeenCalledWith(mockEvent, 503)
    expect(setResponseHeader).toHaveBeenCalledWith(mockEvent, 'cache-control', 'no-store')
  })

  it('statusCode 인자를 따른다', () => {
    markDegradedResponse(502)
    expect(setResponseStatus).toHaveBeenCalledWith(mockEvent, 502)
  })

  it('이벤트가 없으면(클라이언트) no-op', () => {
    mockEvent = undefined
    markDegradedResponse()
    expect(setResponseStatus).not.toHaveBeenCalled()
    expect(setResponseHeader).not.toHaveBeenCalled()
  })
})
