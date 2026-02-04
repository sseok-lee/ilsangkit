<template>
  <NuxtErrorBoundary @error="handleError">
    <slot />

    <template #error="{ error, clearError }">
      <div
        class="flex flex-col items-center justify-center min-h-[200px] p-6 bg-red-50 dark:bg-red-900/20 rounded-lg"
        data-testid="error-boundary"
      >
        <!-- Error Icon -->
        <div class="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center mb-4">
          <svg
            class="w-8 h-8 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <!-- Error Message -->
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">
          {{ title || '오류가 발생했습니다' }}
        </h3>
        <p class="text-sm text-slate-600 dark:text-slate-400 text-center mb-4 max-w-md">
          {{ formatErrorMessage(error) }}
        </p>

        <!-- Actions -->
        <div class="flex gap-3">
          <button
            class="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium"
            data-testid="error-retry-button"
            @click="handleRetry(clearError)"
          >
            다시 시도
          </button>
          <button
            v-if="showHomeButton"
            class="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors text-sm font-medium"
            @click="navigateToHome"
          >
            홈으로 이동
          </button>
        </div>

        <!-- Error Details (Development only) -->
        <details
          v-if="showDetails && error"
          class="mt-4 w-full max-w-lg"
        >
          <summary class="text-xs text-slate-500 cursor-pointer hover:text-slate-700">
            오류 상세 정보
          </summary>
          <pre class="mt-2 p-3 bg-slate-100 dark:bg-slate-800 rounded text-xs overflow-auto max-h-40 text-slate-700 dark:text-slate-300">{{ formatErrorDetails(error) }}</pre>
        </details>
      </div>
    </template>
  </NuxtErrorBoundary>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

interface Props {
  title?: string
  showHomeButton?: boolean
  showDetails?: boolean
  onRetry?: () => void | Promise<void>
}

interface Emits {
  (e: 'error', error: Error): void
  (e: 'retry'): void
}

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
  showHomeButton: true,
  showDetails: process.env.NODE_ENV === 'development',
  onRetry: undefined,
})

const emit = defineEmits<Emits>()
const router = useRouter()

function handleError(error: Error) {
  console.error('[ErrorBoundary] Error caught:', error)
  emit('error', error)
}

async function handleRetry(clearError: () => void) {
  emit('retry')

  if (props.onRetry) {
    await props.onRetry()
  }

  clearError()
}

function navigateToHome() {
  router.push('/')
}

function formatErrorMessage(error: unknown): string {
  if (!error) return '알 수 없는 오류가 발생했습니다.'

  if (error instanceof Error) {
    // API errors
    if ('statusCode' in error) {
      const statusCode = (error as any).statusCode
      if (statusCode === 404) return '요청한 정보를 찾을 수 없습니다.'
      if (statusCode === 500) return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      if (statusCode === 503) return '서비스가 일시적으로 이용 불가합니다.'
    }

    return error.message || '오류가 발생했습니다.'
  }

  if (typeof error === 'string') return error

  return '알 수 없는 오류가 발생했습니다.'
}

function formatErrorDetails(error: unknown): string {
  if (!error) return ''

  try {
    if (error instanceof Error) {
      return JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5).join('\n'),
        ...(('statusCode' in error) && { statusCode: (error as any).statusCode }),
        ...(('data' in error) && { data: (error as any).data }),
      }, null, 2)
    }
    return JSON.stringify(error, null, 2)
  } catch {
    return String(error)
  }
}
</script>
