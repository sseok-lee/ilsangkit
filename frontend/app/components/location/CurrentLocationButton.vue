<template>
  <button
    :class="buttonClasses"
    :disabled="isDisabled"
    :aria-label="ariaLabel"
    :aria-busy="isLoading"
    @click="handleClick"
  >
    <!-- 로딩 스피너 -->
    <svg
      v-if="isLoading"
      class="animate-spin h-5 w-5 mr-2"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>

    <!-- 위치 아이콘 (기본 상태) -->
    <svg
      v-else-if="!error"
      class="h-5 w-5 mr-2"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>

    <!-- 경고 아이콘 (에러 상태) -->
    <svg
      v-else
      class="h-5 w-5 mr-2"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>

    <!-- 텍스트 -->
    <span v-if="isLoading">위치 확인 중...</span>
    <span v-else-if="error">{{ errorMessage }}</span>
    <span v-else>현재 위치</span>
  </button>

  <!-- 에러 메시지 (툴팁 형태) -->
  <div v-if="error && showErrorDetails" class="mt-2 text-sm text-red-600">
    {{ error.message }}
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGeolocation } from '~/composables/useGeolocation'

interface Props {
  disabled?: boolean
  showErrorDetails?: boolean
}

interface Emits {
  locationFound: [position: { lat: number; lng: number }]
  error: [message: string]
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  showErrorDetails: true,
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
      'text-red-700',
      'border-2',
      'border-red-300',
      'hover:bg-red-100',
      'focus:ring-red-500'
    )
  } else {
    // 기본 상태
    classes.push(
      'bg-primary-600',
      'text-white',
      'hover:bg-primary-700',
      'focus:ring-primary-500',
      'active:bg-primary-800'
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
