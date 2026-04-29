<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[900] flex items-center justify-center bg-black/45 backdrop-blur-sm px-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="region-modal-title"
        @click.self="handleClose"
        @keydown.esc="handleClose"
      >
        <div class="w-full max-w-[440px] bg-white rounded-3xl shadow-2xl p-7">
          <header class="flex items-center justify-between mb-5">
            <h2 id="region-modal-title" class="text-lg font-extrabold text-slate-900 tracking-tight">
              내 동네 설정
            </h2>
            <button
              class="size-8 rounded-lg border border-line text-slate-400 hover:bg-background-light flex items-center justify-center"
              aria-label="닫기"
              @click="handleClose"
            >
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </header>

          <!-- 시/도, 구/군 -->
          <div class="mb-4">
            <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">시/도 · 시군구</p>
            <div class="grid grid-cols-2 gap-2.5">
              <select
                v-model="selectedCity"
                class="h-11 px-3.5 rounded-xl border border-line bg-background-light text-sm font-medium text-slate-900 focus:outline-none focus:border-primary"
                aria-label="시/도 선택"
              >
                <option value="">시/도 선택</option>
                <option v-for="c in cityOptions" :key="c.slug" :value="c.slug">{{ c.name }}</option>
              </select>
              <select
                v-model="selectedDistrict"
                :disabled="!selectedCity"
                class="h-11 px-3.5 rounded-xl border border-line bg-background-light text-sm font-medium text-slate-900 focus:outline-none focus:border-primary disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="구/시 선택"
              >
                <option value="">구/시 선택</option>
                <option v-for="d in districtOptions" :key="d.slug" :value="d.slug">{{ d.name }}</option>
              </select>
            </div>
          </div>

          <!-- 동 (v2) -->
          <div class="mb-5">
            <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              동 (읍·면·동)
              <span class="text-[10px] font-bold text-accent-2 bg-accent-2/10 px-2 py-0.5 rounded-full normal-case tracking-normal">곧 지원 예정</span>
            </p>
            <select
              disabled
              class="w-full h-11 px-3.5 rounded-xl border border-line bg-background-light text-sm text-slate-400 disabled:opacity-50"
              aria-label="동 선택 (비활성화)"
            >
              <option>전체 구 기준 (동 미지정)</option>
            </select>
            <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">
              동을 설정하면 시설은 <strong class="text-slate-700">반경 1.5km</strong>, 부동산은 해당 동 데이터만 표시됩니다. (다음 업데이트 예정)
            </p>
          </div>

          <!-- Preview -->
          <div
            v-if="previewLabel"
            data-testid="region-preview"
            class="flex items-center gap-2.5 px-4 py-3 mb-5 bg-background-light border border-line rounded-xl"
          >
            <span class="material-symbols-outlined text-primary text-[20px]">location_on</span>
            <div class="min-w-0">
              <div class="text-sm font-semibold text-slate-900 truncate">{{ previewLabel }}</div>
              <div class="text-xs text-slate-500">부동산·시설 모두 {{ previewDistrictName }} 전체 기준</div>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2.5">
            <button
              class="flex-1 h-11 rounded-xl border border-line text-sm font-semibold text-slate-500 hover:bg-background-light"
              @click="handleClose"
            >
              취소
            </button>
            <button
              class="flex-[2] h-11 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              :disabled="!canSave"
              data-testid="region-save"
              @click="handleSave"
            >
              이 동네로 설정
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRegionStore } from '~/stores/region'
import { useRegions } from '~/composables/useRegions'

interface Props {
  open: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const regionStore = useRegionStore()
const { citiesWithDistricts, loadRegions, isLoaded } = useRegions()

const selectedCity = ref('')
const selectedDistrict = ref('')

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    if (!isLoaded.value) {
      await loadRegions()
    }
    selectedCity.value = regionStore.citySlug ?? ''
    selectedDistrict.value = regionStore.districtSlug ?? ''
  },
  { immediate: true }
)

watch(selectedCity, () => {
  selectedDistrict.value = ''
})

const cityOptions = computed(() =>
  citiesWithDistricts.value.map((c) => ({ slug: c.slug, name: c.name }))
)

const districtOptions = computed(() => {
  const city = citiesWithDistricts.value.find((c) => c.slug === selectedCity.value)
  return city?.districts.map((d) => ({ slug: d.slug, name: d.name })) ?? []
})

const previewDistrictName = computed(() => {
  const d = districtOptions.value.find((opt) => opt.slug === selectedDistrict.value)
  return d?.name ?? ''
})

const previewLabel = computed(() => {
  if (!selectedCity.value || !selectedDistrict.value) return ''
  const cityName = cityOptions.value.find((c) => c.slug === selectedCity.value)?.name ?? ''
  return `${cityName} ${previewDistrictName.value}`
})

const canSave = computed(() => Boolean(selectedCity.value && selectedDistrict.value))

function handleSave() {
  if (!canSave.value) return
  regionStore.setRegion({
    citySlug: selectedCity.value,
    districtSlug: selectedDistrict.value,
  })
  emit('close')
}

function handleClose() {
  emit('close')
}
</script>
