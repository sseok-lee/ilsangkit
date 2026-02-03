<template>
  <button
    :class="buttonClasses"
    :disabled="isDisabled"
    :aria-label="ariaLabel"
    :aria-busy="isLoading"
    @click="handleClick"
  >
    <!-- 로딩 스피너 -->
    <span v-if="isLoading" :class="[compact ? 'w-4 h-4' : 'w-5 h-5', compact ? '' : 'mr-2']" class="animate-spin inline-block">
      <svg class="w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </span>

    <!-- 위치 아이콘 (기본 상태) -->
    <span
      v-else-if="!error"
      :class="[compact ? 'text-[16px]' : 'text-[20px]', compact ? '' : 'mr-2']"
      class="material-symbols-outlined"
    >
      my_location
    </span>

    <!-- 경고 아이콘 (에러 상태) -->
    <span
      v-else
      :class="[compact ? 'text-[16px]' : 'text-[20px]', compact ? '' : 'mr-2']"
      class="material-symbols-outlined"
    >
      warning
    </span>

    <!-- 텍스트 -->
    <template v-if="!compact">
      <span v-if="isLoading">위치 확인 중...</span>
      <span v-else-if="error">{{ errorMessage }}</span>
      <span v-else>현재 위치</span>
    </template>
    <template v-else>
      <span v-if="!isLoading && !error" class="ml-1 text-xs font-medium">내 위치</span>
    </template>
  </button>

  <!-- 에러 메시지 (툴팁 형태) -->
  <div v-if="error && showErrorDetails && !compact" class="mt-2 text-sm text-red-600 dark:text-red-400">
    {{ error.message }}
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGeolocation } from '~/composables/useGeolocation'

interface Props {
  disabled?: boolean
  showErrorDetails?: boolean
  compact?: boolean
}

interface Emits {
  locationFound: [position: { lat: number; lng: number }]
  error: [message: string]
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  showErrorDetails: true,
  compact: false,
})

const emit = defineEmits<Emits>()

const { isLoading, error, getCurrentPosition } = useGeolocation()

const isDisabled = computed(() => props.disabled || isLoading.value)

const ariaLabel = computed(() => {
  if (isLoading.value) return '현재 위치 확인 중'
  if (error.value) return '위치 확인 오류'
  return '현재 위치로 검색'
})

const errorMessage = computed(() => {
  if (!error.value) return ''

  // 간단한 에러 메시지 (버튼용)
  if (error.value.code === 1) return '권한 거부'
  if (error.value.code === 2) return '위치 불가'
  if (error.value.code === 3) return '시간 초과'
  return '오류 발생'
})

const buttonClasses = computed(() => {
  if (props.compact) {
    // Compact style for filter buttons
    const classes = [
      'flex',
      'h-8',
      'shrink-0',
      'items-center',
      'justify-center',
      'gap-x-1',
      'rounded-lg',
      'px-3',
      'transition-colors',
    ]

    if (error.value) {
      classes.push('bg-red-100', 'dark:bg-red-900/30', 'text-red-700', 'dark:text-red-400', 'hover:bg-red-200', 'dark:hover:bg-red-900/50')
    } else {
      classes.push('bg-slate-100', 'dark:bg-slate-800', 'hover:bg-slate-200', 'dark:hover:bg-slate-700', 'text-slate-700', 'dark:text-slate-300')
    }

    if (isDisabled.value) {
      classes.push('opacity-50', 'cursor-not-allowed')
    }

    return classes
  }

  // Full size style
  const classes = [
    'inline-flex',
    'items-center',
    'justify-center',
    'px-4',
    'py-2.5',
    'font-medium',
    'text-base',
    'rounded-lg',
    'transition-all',
    'duration-200',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-2',
    'min-h-11',
    'min-w-11',
  ]

  if (error.value) {
    // 에러 상태
    classes.push(
      'bg-red-50',
      'dark:bg-red-900/30',
      'text-red-700',
      'dark:text-red-400',
      'border-2',
      'border-red-300',
      'dark:border-red-700',
      'hover:bg-red-100',
      'dark:hover:bg-red-900/50',
      'focus:ring-red-500'
    )
  } else {
    // 기본 상태
    classes.push(
      'bg-primary',
      'text-white',
      'hover:bg-blue-600',
      'focus:ring-primary',
      'active:bg-blue-700'
    )
  }

  if (isDisabled.value) {
    classes.push('opacity-50', 'cursor-not-allowed')
  }

  return classes
})

const handleClick = async () => {
  if (isDisabled.value) return

  try {
    const position = await getCurrentPosition()
    emit('locationFound', position)
  } catch (err: any) {
    emit('error', err.message || '위치를 가져올 수 없습니다.')
  }
}
</script>

<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
