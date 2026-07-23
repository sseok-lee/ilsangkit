<template>
  <div class="rounded-2xl bg-white border border-slate-200 p-5">
    <button
      type="button"
      class="flex items-center gap-2 w-full"
      @click="expanded = !expanded"
    >
      <span class="material-symbols-outlined text-primary text-[20px]">local_hospital</span>
      <h3 class="text-base font-bold text-slate-900">진료 과목</h3>
      <span v-if="selected.length > 0" class="text-xs font-medium text-primary">
        {{ selected.length }}개 선택
      </span>
      <span class="ml-auto material-symbols-outlined text-slate-500 text-[20px]">
        {{ expanded ? 'expand_less' : 'expand_more' }}
      </span>
    </button>

    <div v-if="expanded" class="mt-4">
      <div v-if="pending" class="flex flex-wrap gap-2">
        <div v-for="i in 12" :key="i" class="h-8 w-20 bg-slate-100 rounded-full animate-pulse"></div>
      </div>

      <div v-else class="flex flex-wrap gap-2 max-h-[280px] overflow-y-auto pr-1">
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
    </div>

    <!-- collapsed: show selected chips inline preview -->
    <div v-else-if="selected.length > 0" class="mt-3 flex flex-wrap gap-1.5">
      <span
        v-for="name in selected"
        :key="name"
        class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20"
      >
        {{ name }}
      </span>
    </div>

    <div v-if="expanded" class="mt-4 flex items-center gap-3">
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
        @click="applyAndCollapse"
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

const expanded = ref(false)
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

function applyAndCollapse(): void {
  apply()
  expanded.value = false
}
</script>
