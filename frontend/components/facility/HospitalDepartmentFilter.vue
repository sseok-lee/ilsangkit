<template>
  <section class="section-flat">
    <h2 class="ui-h2 text-strong">
      <button
        type="button"
        data-test="dept-toggle"
        class="flex w-full items-center gap-2 min-h-[44px] text-left"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <span>진료 과목</span>
        <span v-if="selected.length > 0" class="text-sm font-semibold text-primary">{{ selected.length }}개 선택</span>
        <span class="ml-auto material-symbols-outlined text-muted text-[22px]" aria-hidden="true">{{ expanded ? 'expand_less' : 'expand_more' }}</span>
      </button>
    </h2>

    <div v-if="expanded" class="mt-4">
      <div v-if="pending" class="flex flex-wrap gap-2">
        <div v-for="i in 12" :key="i" class="h-11 w-24 rounded-[7px] bg-background-light animate-pulse"></div>
      </div>
      <div v-else class="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto pr-1">
        <UiChip
          v-for="dept in items"
          :key="dept.name"
          :selected="selected.includes(dept.name)"
          @click="toggle(dept.name)"
        >
          {{ dept.name }}
          <span class="text-[12px] font-medium text-muted tabular-nums">({{ dept.count.toLocaleString('ko-KR') }})</span>
        </UiChip>
      </div>
      <div class="mt-4 flex items-center gap-3">
        <UiButton variant="secondary" data-test="dept-reset" :disabled="selected.length === 0" @click="reset">초기화</UiButton>
        <UiButton variant="primary" data-test="dept-apply" class="flex-1" :disabled="!isDirty" @click="applyAndCollapse">적용</UiButton>
      </div>
    </div>

    <div v-else-if="selected.length > 0" class="mt-3 flex flex-wrap gap-1.5">
      <span
        v-for="name in selected"
        :key="name"
        class="inline-flex items-center px-2.5 py-1 rounded-[7px] text-[12px] font-semibold bg-primary-50 text-primary border border-brand-line"
      >{{ name }}</span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UiButton from '~/components/common/UiButton.vue'
import UiChip from '~/components/common/UiChip.vue'
import { useHospitalDepartments } from '~/composables/useHospitalDepartments'

interface Props {
  modelValue: string[]
  variant?: 'flat'
}
const props = withDefaults(defineProps<Props>(), { variant: 'flat' })
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
