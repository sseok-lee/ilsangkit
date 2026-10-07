<template>
  <section class="flex flex-col gap-4">
    <div v-if="loadState === 'error'" class="rounded-md border border-red-200 bg-red-50 p-3">
      <p data-testid="provider-disclosure-load-error" role="alert" class="text-sm text-red-700">
        문구 설정을 불러오지 못했습니다
      </p>
      <button
        type="button"
        data-testid="provider-disclosure-retry"
        class="mt-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-ink"
        @click="emit('retry')"
      >
        다시 시도
      </button>
    </div>

    <p
      v-if="loadState === 'loading'"
      data-testid="provider-disclosure-loading"
      class="rounded-md border border-line bg-background-light px-3 py-2 text-sm text-muted"
    >
      불러오는 중...
    </p>

    <form v-if="loadState !== 'error'" class="flex flex-col gap-4" @submit.prevent="save">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-[12rem_minmax(0,1fr)]">
        <div>
          <label for="provider-disclosure-provider" class="mb-1 block text-xs font-medium text-muted">업체</label>
          <select
            id="provider-disclosure-provider"
            :value="provider"
            data-testid="provider-disclosure-provider"
            :disabled="inputLocked"
            class="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            @change="onProviderChange"
          >
            <option value="coupang">쿠팡</option>
            <option value="ali">알리</option>
            <option value="toss">토스</option>
          </select>
        </div>

        <div class="rounded-md border border-line bg-white px-3 py-2">
          <p data-testid="provider-disclosure-status" class="text-sm font-medium text-ink">
            {{ currentRegistered ? '기본 문구 등록됨' : '아직 기본 문구가 등록되지 않았습니다' }}
          </p>
          <p data-testid="provider-disclosure-updated" class="mt-1 text-xs text-muted">
            {{ updatedAtLabel }}
          </p>
        </div>
      </div>

      <div>
        <label for="provider-disclosure-text" class="mb-1 block text-xs font-medium text-muted">기본 문구</label>
        <textarea
          id="provider-disclosure-text"
          v-model="draftText"
          data-testid="provider-disclosure-text"
          rows="6"
          :disabled="inputLocked"
          class="w-full resize-y rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
        />
        <div class="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p class="text-xs text-muted">
            해당 제휴 프로그램에서 안내한 수익 고지 문구를 확인해 입력하세요. 기본 문구를 사용하는 배너에 함께 적용됩니다.
          </p>
          <span data-testid="provider-disclosure-count" class="text-xs text-muted">
            {{ draftText.length }} / 1000
          </span>
        </div>
      </div>

      <p
        v-if="message"
        data-testid="provider-disclosure-error"
        role="alert"
        class="text-sm text-red-600"
      >
        {{ message }}
      </p>

      <div class="flex flex-wrap gap-2 border-t border-line pt-2">
        <button
          type="submit"
          data-testid="provider-disclosure-save"
          class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          :disabled="saving || loadState !== 'ready'"
        >
          {{ saving ? '저장 중' : '저장' }}
        </button>
        <button
          type="button"
          data-testid="provider-disclosure-cancel"
          class="rounded-md bg-line px-3 py-2 text-sm font-medium text-ink disabled:opacity-60"
          :disabled="inputLocked || !isDirty"
          @click="resetFromCurrentSettings"
        >
          취소
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAdminAffiliateDisclosures } from '~/composables/useAdminAffiliateDisclosures'
import type { AffiliateProvider } from '~/types/affiliateBanner'
import type {
  AffiliateDisclosureLoadState,
  AffiliateProviderDisclosureDto,
} from '~/types/affiliateDisclosure'
import { normalizeAffiliateDisclosureText } from '~/utils/affiliateDisclosure'

const props = withDefaults(defineProps<{
  settings: readonly AffiliateProviderDisclosureDto[]
  loadState: AffiliateDisclosureLoadState
  initialProvider?: AffiliateProvider
}>(), {
  initialProvider: 'coupang',
})

const emit = defineEmits<{
  saved: [dto: AffiliateProviderDisclosureDto]
  'dirty-change': [value: boolean]
  'busy-change': [value: boolean]
  retry: []
}>()

const DIRTY_CONFIRM = '저장하지 않은 업체별 문구 변경 내용이 있습니다. 이동하시겠습니까?'
const api = useAdminAffiliateDisclosures()
const provider = ref<AffiliateProvider>(props.initialProvider)
const draftText = ref('')
const savedText = ref('')
const savedUpdatedAt = ref<string | null>(null)
const saving = ref(false)
const message = ref('')
const lastDirty = ref(false)

const isDirty = computed(() => draftText.value !== savedText.value)
const inputLocked = computed(() => saving.value || props.loadState !== 'ready')
const currentRegistered = computed(() => savedText.value.length > 0)
const updatedAtLabel = computed(() => {
  if (!savedUpdatedAt.value) return '수정 시각 없음'
  return `마지막 수정 ${formatDate(savedUpdatedAt.value)}`
})

function providerSetting(targetProvider = provider.value): AffiliateProviderDisclosureDto | undefined {
  return props.settings.find((item) => item.provider === targetProvider)
}

function applySnapshot(targetProvider = provider.value) {
  const setting = providerSetting(targetProvider)
  savedText.value = setting?.defaultDisclosureText ?? ''
  savedUpdatedAt.value = setting?.updatedAt ?? null
  draftText.value = savedText.value
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function confirmDiscard() {
  if (!isDirty.value) return true
  return window.confirm(DIRTY_CONFIRM)
}

function onProviderChange(event: Event) {
  const select = event.target as HTMLSelectElement
  const nextProvider = select.value as AffiliateProvider
  if (nextProvider === provider.value) return
  if (!confirmDiscard()) {
    select.value = provider.value
    return
  }
  provider.value = nextProvider
  message.value = ''
  applySnapshot(nextProvider)
}

function resetFromCurrentSettings() {
  message.value = ''
  applySnapshot()
}

async function save() {
  if (saving.value || props.loadState !== 'ready') return
  const text = normalizeAffiliateDisclosureText(draftText.value)
  if (text.length < 1 || text.length > 1000) {
    message.value = '문구는 1~1,000자로 입력하세요'
    return
  }

  saving.value = true
  message.value = ''
  const requestedProvider = provider.value
  try {
    const dto = await api.save(requestedProvider, text)
    if (provider.value !== requestedProvider) return
    savedText.value = dto.defaultDisclosureText ?? ''
    savedUpdatedAt.value = dto.updatedAt
    draftText.value = savedText.value
    emit('saved', dto)
    emit('dirty-change', false)
  } catch {
    message.value = '문구를 저장하지 못했습니다'
  } finally {
    saving.value = false
  }
}

watch(saving, (value) => {
  emit('busy-change', value)
})

watch(isDirty, (value) => {
  if (value === lastDirty.value) return
  lastDirty.value = value
  emit('dirty-change', value)
})

watch(
  () => props.settings,
  () => {
    const setting = providerSetting()
    savedText.value = setting?.defaultDisclosureText ?? ''
    savedUpdatedAt.value = setting?.updatedAt ?? null
    if (!lastDirty.value) draftText.value = savedText.value
  },
  { deep: true }
)

watch(
  () => props.initialProvider,
  (nextProvider) => {
    if (nextProvider === provider.value || !confirmDiscard()) return
    provider.value = nextProvider
    message.value = ''
    applySnapshot(nextProvider)
  }
)

applySnapshot()
</script>
