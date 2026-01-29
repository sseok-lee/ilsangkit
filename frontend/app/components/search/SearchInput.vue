<template>
  <div class="relative w-full">
    <input
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      class="w-full px-4 py-3 pr-12 text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      @input="onInput"
      @keydown.enter="onSearch"
    />
    <button
      type="button"
      class="absolute right-2 top-1/2 -translate-y-1/2 p-2 min-h-11 min-w-11 flex items-center justify-center text-gray-500 hover:text-indigo-600 transition-colors rounded-lg hover:bg-gray-100"
      @click="onSearch"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        class="w-5 h-5"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'SearchInput',
})

interface Props {
  modelValue: string
  placeholder?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'search'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function onSearch() {
  emit('search')
}
</script>
