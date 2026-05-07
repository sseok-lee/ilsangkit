<template>
  <div class="rounded-2xl bg-white border border-slate-200 p-5">
    <div class="flex items-center gap-2 mb-4">
      <span class="material-symbols-outlined text-primary text-[20px]">stethoscope</span>
      <h3 class="text-base font-bold text-slate-900">진료 과목</h3>
      <span v-if="selected.length > 0" class="ml-auto text-xs font-medium text-primary">
        {{ selected.length }}개 선택
      </span>
    </div>

    <div v-if="pending" class="flex flex-wrap gap-2">
      <div v-for="i in 12" :key="i" class="h-8 w-20 bg-slate-100 rounded-full animate-pulse"></div>
    </div>

    <div v-else class="flex flex-wrap gap-2">
      <button
        v-for="dept in items"
        :key="dept.name"
        type="button"
        @click="toggle(dept.name)"
        :class="[
          'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
          selected.includes(dept.name)
            ? 'bg-primary text-white border-primary'
            : 'bg-white text-slate-700 border-slate-200 hover:border-primary hover:text-primary',
        ]"
      >
        <span class="material-symbols-outlined text-[14px]" v-if="selected.includes(dept.name)">check</span>
        {{ dept.name }}
        <span class="text-[10px] opacity-70">({{ dept.count }})</span>
      </button>
    </div>

    <div class="mt-4 flex items-center gap-3">
      <button
        type="button"
        @click="reset"
        :disabled="selected.length === 0"
        class="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-50 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        초기화
      </button>
      <button
        type="button"
        @click="apply"
        :disabled="!isDirty"
        class="flex-1 px-4 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        적용
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useHospitalDepartments } from '~/composables/useHospitalDepartments'

interface Props {
  modelValue: string[]
}
const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
  (e: 'apply', value: string[]): void
}>()

const { data, pending } = useHospitalDepartments()
const items = computed(() => data.value ?? [])

const selected = ref<string[]>([...props.modelValue])

watch(
  () => props.modelValue,
  (next) => {
    selected.value = [...next]
  },
)

const isDirty = computed(() => {
  if (selected.value.length !== props.modelValue.length) return true
  const a = [...selected.value].sort()
  const b = [...props.modelValue].sort()
  return a.some((v, i) => v !== b[i])
})

function toggle(name: string): void {
  const idx = selected.value.indexOf(name)
  if (idx >= 0) selected.value.splice(idx, 1)
  else selected.value.push(name)
}

function reset(): void {
  selected.value = []
  emit('update:modelValue', [])
  emit('apply', [])
}

function apply(): void {
  emit('update:modelValue', [...selected.value])
  emit('apply', [...selected.value])
}
</script>
