<template>
  <div class="relative w-full group">
    <!-- 검색 아이콘 (좌측) -->
    <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
      <span class="material-symbols-outlined text-[24px]">search</span>
    </div>
    <!-- 검색 입력 -->
    <input
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      class="block w-full pl-12 pr-4 py-4 bg-white dark:bg-surface-dark border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-600"
      @input="onInput"
      @keydown.enter="onSearch"
    />
    <!-- 검색 버튼 (우측 내장) -->
    <div class="absolute inset-y-2 right-2">
      <button
        type="button"
        class="h-full px-5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-xl transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
        @click="onSearch"
      >
        <span>{{ buttonText }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'SearchInput',
})

interface Props {
  modelValue: string
  placeholder?: string
  buttonText?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'search'): void
}

withDefaults(defineProps<Props>(), {
  buttonText: '검색',
})
const emit = defineEmits<Emits>()

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

function onSearch() {
  emit('search')
}
</script>

<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
