<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { USAGE_GROUP_LABEL, statusLabel, type AuctionStatusMode } from '~/types/auction'
import RegionCascadingDropdown from '~/components/common/RegionCascadingDropdown.vue'

const props = withDefaults(defineProps<{ usage: string; status: string; city: string; district: string; statusMode?: AuctionStatusMode; keyword?: string }>(), { statusMode: 'legacy', keyword: '' })
const emit = defineEmits<{
  'update:usage': [string]; 'update:status': [string]; 'update:city': [string]; 'update:district': [string]
  'update:statusMode': [AuctionStatusMode]; 'update:keyword': [string]
}>()
const usageOptions = Object.entries(USAGE_GROUP_LABEL)
const draft = ref(props.keyword)
watch(() => props.keyword, value => { draft.value = value })
const selectedStatus = computed(() => props.statusMode === 'exact' && props.status ? `exact:${props.status}` : props.status)
const statuses = [
  ['', '전체 상태'], ['ongoing', '진행·예정'], ['closed', '마감 전체'], ['negotiable', '수의계약'],
  ...['ongoing', 'scheduled', 'negotiable', 'closed', 'sold', 'failed', 'cancelled'].map(status => [`exact:${status}`, statusLabel(status)]),
]
function onStatus(value: string) {
  emit('update:status', value.replace(/^exact:/, ''))
  emit('update:statusMode', value.startsWith('exact:') ? 'exact' : 'legacy')
}
function onCity(value: string) {
  emit('update:city', value)
  emit('update:district', '')
}
</script>
<template>
  <div class="flex flex-col gap-4">
    <form class="flex flex-wrap gap-2" @submit.prevent="emit('update:keyword', draft.trim())">
      <label class="sr-only" for="auction-keyword">주소·용도·관리번호 검색</label>
      <input id="auction-keyword" v-model="draft" name="keyword" maxlength="100" class="min-h-11 min-w-0 flex-1 rounded-lg border border-line px-3 text-sm" placeholder="주소, 용도, 관리번호">
      <button type="submit" class="min-h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-white">검색</button>
    </form>
    <div class="grid gap-3 md:grid-cols-2">
      <label class="grid gap-1 text-sm text-muted" for="auction-usage">용도
        <select id="auction-usage" data-testid="usage" :value="usage" class="min-h-11 min-w-0 rounded-lg border border-line px-3 text-ink" @change="emit('update:usage', ($event.target as HTMLSelectElement).value)">
          <option value="" :selected="!usage">전체 용도</option>
          <option v-for="[key, label] in usageOptions" :key="key" :value="key" :selected="usage === key">{{ label }}</option>
        </select>
      </label>
      <label class="grid gap-1 text-sm text-muted" for="auction-status">상태
        <select id="auction-status" data-testid="status" :value="selectedStatus" class="min-h-11 min-w-0 rounded-lg border border-line px-3 text-ink" @change="onStatus(($event.target as HTMLSelectElement).value)">
          <option v-for="[key, label] in statuses" :key="key" :value="key" :selected="selectedStatus === key">{{ label }}</option>
        </select>
      </label>
    </div>
    <RegionCascadingDropdown variant="flat" :city="city" :district="district" city-value-mode="short" preserve-current-selection @update:city="onCity" @update:district="emit('update:district', $event)" />
  </div>
</template>
