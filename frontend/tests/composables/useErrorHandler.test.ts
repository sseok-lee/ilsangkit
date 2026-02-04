import { describe, it, expect, vi } from 'vitest'
import { useErrorHandler, normalizeError, getErrorType } from '~/composables/useErrorHandler'

describe('normalizeError', () => {
  it('normalizes 404 FetchError', () => {
    const error = {
      statusCode: 404,
      message: 'Not Found',
    }

    const result = normalizeError(error)

    expect(result.code).toBe('NOT_FOUND')
    expect(result.statusCode).toBe(404)
    expect(result.message).toBe('요청한 정보를 찾을 수 없습니다.')
  })

  it('normalizes 422 Validation Error', () => {
    const error = {
      statusCode: 422,
      message: 'Validation failed',
      data: {
        details: { field: 'email' },
      },
    }

    const result = normalizeError(error)

    expect(result.code).toBe('VALIDATION_ERROR')
    expect(result.statusCode).toBe(422)
    expect(result.details).toEqual({ field: 'email' })
  })

  it('normalizes 500 Server Error', () => {
    const error = {
      statusCode: 500,
      message: 'Internal Server Error',
    }

    const result = normalizeError(error)

    expect(result.code).toBe('SERVER_ERROR')
    expect(result.statusCode).toBe(500)
    expect(result.message).toBe('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
  })

  it('normalizes standard Error', () => {
    const error = new Error('Something went wrong')

    const result = normalizeError(error)

    expect(result.code).toBe('UNKNOWN_ERROR')
    expect(result.message).toBe('Something went wrong')
    expect(result.originalError).toBe(error)
  })

  it('normalizes string error', () => {
    const result = normalizeError('Error message')

    expect(result.code).toBe('UNKNOWN_ERROR')
    expect(result.message).toBe('Error message')
  })

  it('handles unknown error types', () => {
    const result = normalizeError({ random: 'object' })

    expect(result.code).toBe('UNKNOWN_ERROR')
    expect(result.message).toBe('알 수 없는 오류가 발생했습니다.')
  })
})

describe('getErrorType', () => {
  it('returns correct type for NETWORK_ERROR', () => {
    expect(getErrorType({ code: 'NETWORK_ERROR', message: '' })).toBe('network')
  })

  it('returns correct type for VALIDATION_ERROR', () => {
    expect(getErrorType({ code: 'VALIDATION_ERROR', message: '' })).toBe('validation')
  })

  it('returns correct type for NOT_FOUND', () => {
    expect(getErrorType({ code: 'NOT_FOUND', message: '' })).toBe('notfound')
  })

  it('returns correct type for SERVER_ERROR', () => {
    expect(getErrorType({ code: 'SERVER_ERROR', message: '' })).toBe('server')
  })

  it('returns unknown for unrecognized codes', () => {
    expect(getErrorType({ code: 'RANDOM_CODE', message: '' })).toBe('unknown')
  })
})

describe('useErrorHandler', () => {
  it('initializes with no error', () => {
    const { error, isError } = useErrorHandler()

    expect(error.value).toBeNull()
    expect(isError.value).toBe(false)
  })

  it('sets and clears error', () => {
    const { error, isError, setError, clearError } = useErrorHandler()

    setError(new Error('Test'))

    expect(error.value).not.toBeNull()
    expect(error.value?.message).toBe('Test')
    expect(isError.value).toBe(true)

    clearError()

    expect(error.value).toBeNull()
    expect(isError.value).toBe(false)
  })

  it('withErrorHandling returns result on success', async () => {
    const { withErrorHandling, error, isError } = useErrorHandler()

    const result = await withErrorHandling(async () => 'success')

    expect(result).toBe('success')
    expect(error.value).toBeNull()
    expect(isError.value).toBe(false)
  })

  it('withErrorHandling catches and normalizes error', async () => {
    const { withErrorHandling, error, isError } = useErrorHandler()

    const result = await withErrorHandling(async () => {
      throw new Error('Failed')
    })

    expect(result).toBeNull()
    expect(error.value?.message).toBe('Failed')
    expect(isError.value).toBe(true)
  })

  it('withErrorHandling calls onError callback', async () => {
    const { withErrorHandling } = useErrorHandler()
    const onError = vi.fn()

    await withErrorHandling(
      async () => {
        throw new Error('Failed')
      },
      { onError }
    )

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed',
      })
    )
  })
})
