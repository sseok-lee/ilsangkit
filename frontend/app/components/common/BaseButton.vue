<template>
  <button
    :class="buttonClasses"
    :disabled="disabled"
    @click="handleClick"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

const buttonClasses = computed(() => {
  const classes = [
    // Base styles
    'font-medium',
    'rounded-lg',
    'transition-all',
    'duration-200',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-2',
    // Minimum touch target (44x44px)
    'min-h-11',
    'min-w-11',
  ]

  // Variant styles
  if (props.variant === 'primary') {
    classes.push(
      'bg-primary-600',
      'text-white',
      'hover:bg-primary-700',
      'focus:ring-primary-500',
      'active:bg-primary-800'
    )
  } else if (props.variant === 'secondary') {
    classes.push(
      'bg-gray-600',
      'text-white',
      'hover:bg-gray-700',
      'focus:ring-gray-500',
      'active:bg-gray-800'
    )
  } else if (props.variant === 'outline') {
    classes.push(
      'border-2',
      'border-primary-600',
      'bg-transparent',
      'text-primary-600',
      'hover:bg-primary-50',
      'focus:ring-primary-500',
      'active:bg-primary-100'
    )
  }

  // Size styles
  if (props.size === 'sm') {
    classes.push('text-sm', 'px-3', 'py-2')
  } else if (props.size === 'md') {
    classes.push('text-base', 'px-4', 'py-2.5')
  } else if (props.size === 'lg') {
    classes.push('text-lg', 'px-6', 'py-3')
  }

  // Disabled state
  if (props.disabled) {
    classes.push('opacity-50', 'cursor-not-allowed')
  }

  return classes
})

const handleClick = (event: MouseEvent) => {
  if (!props.disabled) {
    emit('click', event)
  }
}
</script>
