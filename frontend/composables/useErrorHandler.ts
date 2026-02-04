import { ref, readonly } from 'vue'

/**
 * API 에러 표준화 인터페이스
 */
export interface StandardError {
  code: string
  message: string
  statusCode?: number
  details?: unknown
  originalError?: Error
}

/**
 * 에러 타입 정의
 */
export type ErrorType = 'network' | 'validation' | 'notfound' | 'server' | 'unknown'

/**
 * 에러를 표준 형식으로 변환
 */
export function normalizeError(error: unknown): StandardError {
  // FetchError (Nuxt/ofetch)
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const fetchError = error as any
    const statusCode = fetchError.statusCode

    // 404 Not Found
    if (statusCode === 404) {
      return {
        code: 'NOT_FOUND',
        message: '요청한 정보를 찾을 수 없습니다.',
        statusCode,
        originalError: error instanceof Error ? error : undefined,
      }
    }

    // 422 Validation Error
    if (statusCode === 422) {
      return {
        code: 'VALIDATION_ERROR',
        message: '입력 데이터가 올바르지 않습니다.',
        statusCode,
        details: fetchError.data?.details,
        originalError: error instanceof Error ? error : undefined,
      }
    }

    // 500+ Server Error
    if (statusCode >= 500) {
      return {
        code: 'SERVER_ERROR',
        message: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
        statusCode,
        originalError: error instanceof Error ? error : undefined,
      }
    }

    // Other HTTP errors
    return {
      code: `HTTP_${statusCode}`,
      message: fetchError.message || '요청 처리 중 오류가 발생했습니다.',
      statusCode,
      originalError: error instanceof Error ? error : undefined,
    }
  }

  // Network Error
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      code: 'NETWORK_ERROR',
      message: '네트워크 연결을 확인해주세요.',
      originalError: error,
    }
  }

  // Standard Error
  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || '알 수 없는 오류가 발생했습니다.',
      originalError: error,
    }
  }

  // Unknown
  return {
    code: 'UNKNOWN_ERROR',
    message: typeof error === 'string' ? error : '알 수 없는 오류가 발생했습니다.',
  }
}

/**
 * 에러 타입 판별
 */
export function getErrorType(error: StandardError): ErrorType {
  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'network'
    case 'VALIDATION_ERROR':
      return 'validation'
    case 'NOT_FOUND':
      return 'notfound'
    case 'SERVER_ERROR':
      return 'server'
    default:
      return 'unknown'
  }
}

/**
 * 에러 핸들링 composable
 */
export function useErrorHandler() {
  const error = ref<StandardError | null>(null)
  const isError = ref(false)

  function setError(err: unknown) {
    const normalized = normalizeError(err)
    error.value = normalized
    isError.value = true

    // 콘솔에 에러 로깅 (개발 환경)
    if (process.env.NODE_ENV === 'development') {
      console.error('[useErrorHandler]', normalized)
    }
  }

  function clearError() {
    error.value = null
    isError.value = false
  }

  /**
   * async 함수를 에러 핸들링으로 래핑
   */
  async function withErrorHandling<T>(
    fn: () => Promise<T>,
    options?: { onError?: (error: StandardError) => void }
  ): Promise<T | null> {
    try {
      clearError()
      return await fn()
    } catch (err) {
      const normalized = normalizeError(err)
      setError(err)
      options?.onError?.(normalized)
      return null
    }
  }

  return {
    error: readonly(error),
    isError: readonly(isError),
    setError,
    clearError,
    withErrorHandling,
    normalizeError,
    getErrorType,
  }
}
