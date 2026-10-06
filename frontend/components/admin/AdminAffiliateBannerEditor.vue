<template>
  <form class="flex flex-col gap-4" @submit.prevent="save">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span
        class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
        :class="savedBanner?.isEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-line text-muted'"
      >
        {{ savedBanner?.isEnabled ? '사용 중' : '사용 안 함' }}
      </span>
      <span class="text-xs text-muted">광고·제휴 / {{ providerLabel }}</span>
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <label for="affiliate-provider" class="mb-1 block text-xs font-medium text-muted">업체</label>
        <select
          id="affiliate-provider"
          v-model="draft.provider"
          data-testid="provider"
          :disabled="inputLocked"
          class="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="coupang">쿠팡</option>
          <option value="ali">알리</option>
          <option value="toss">토스</option>
        </select>
      </div>

      <div>
        <label for="affiliate-name" class="mb-1 block text-xs font-medium text-muted">이름</label>
        <input
          id="affiliate-name"
          v-model="draft.name"
          data-testid="name"
          type="text"
          :disabled="inputLocked"
          class="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
      </div>
    </div>

    <fieldset class="rounded-md border border-line p-3">
      <legend class="px-1 text-xs font-medium text-muted">이미지 방식</legend>
      <div class="flex flex-wrap gap-3 text-sm">
        <label class="inline-flex items-center gap-2">
          <input
            v-model="draft.imageSourceType"
            data-testid="source-upload"
            type="radio"
            value="upload"
            :disabled="inputLocked"
            class="accent-primary"
          >
          파일 업로드
        </label>
        <label class="inline-flex items-center gap-2">
          <input
            v-model="draft.imageSourceType"
            data-testid="source-url"
            type="radio"
            value="url"
            :disabled="inputLocked"
            class="accent-primary"
          >
          외부 이미지 URL
        </label>
      </div>
    </fieldset>

    <div v-if="draft.imageSourceType === 'upload'" class="flex flex-col gap-2">
      <label for="affiliate-upload" class="block text-xs font-medium text-muted">이미지 파일</label>
      <input
        id="affiliate-upload"
        data-testid="upload-file"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        :disabled="inputLocked"
        class="block w-full text-sm"
        @change="onFileChange"
      >
      <p class="text-xs text-muted">JPEG, PNG, WebP, GIF만 가능하며 최대 2 MiB까지 업로드할 수 있습니다.</p>
    </div>

    <div v-else>
      <label for="affiliate-external-url" class="mb-1 block text-xs font-medium text-muted">외부 이미지 URL</label>
      <div class="flex gap-2">
        <input
          id="affiliate-external-url"
          v-model="draft.externalImageUrl"
          data-testid="external-image-url"
          type="url"
          :disabled="inputLocked"
          class="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
        <button
          type="button"
          data-testid="preview-button"
          class="rounded-md bg-background-light px-3 py-2 text-sm font-medium text-ink"
          :disabled="inputLocked"
          @click="startUrlPreview"
        >
          미리보기
        </button>
      </div>
    </div>

    <div>
      <label for="affiliate-target-url" class="mb-1 block text-xs font-medium text-muted">제휴 링크</label>
      <div class="flex gap-2">
        <input
          id="affiliate-target-url"
          v-model="draft.targetUrl"
          data-testid="target-url"
          type="url"
          :disabled="inputLocked"
          class="min-w-0 flex-1 rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
        <button
          type="button"
          data-testid="copy-target-url"
          class="rounded-md bg-background-light px-3 py-2 text-sm font-medium text-ink"
          :disabled="inputLocked"
          @click="copyTargetUrl"
        >
          복사
        </button>
      </div>
    </div>

    <div>
      <label for="affiliate-alt" class="mb-1 block text-xs font-medium text-muted">대체 텍스트</label>
      <input
        id="affiliate-alt"
        v-model="draft.altText"
        data-testid="alt-text"
        type="text"
        :disabled="inputLocked"
        class="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
    </div>

    <section class="rounded-md border border-line p-3">
      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span class="text-xs font-semibold text-muted">미리보기</span>
        <span data-testid="preview-state" class="text-xs text-muted">{{ previewStateLabel }}</span>
      </div>
      <div v-if="preview" class="flex flex-col gap-2">
        <img
          v-for="item in [preview]"
          :key="item.generation"
          data-testid="preview-image"
          :src="item.src"
          :alt="draft.altText"
          referrerpolicy="no-referrer"
          class="max-h-72 max-w-full object-contain"
          @load="onPreviewResult(item.generation, 'loaded')"
          @error="onPreviewResult(item.generation, 'error')"
        >
        <span class="text-xs font-medium text-strong">광고·제휴 / {{ providerLabel }}</span>
        <p class="break-all text-xs text-muted">{{ draft.targetUrl }}</p>
      </div>
      <p v-else class="text-xs text-muted">이미지를 업로드하거나 외부 URL 미리보기를 실행하세요.</p>
    </section>

    <p v-if="message" data-testid="editor-message" class="text-sm text-red-600">{{ message }}</p>

    <div class="flex flex-wrap gap-2 border-t border-line pt-2">
      <button
        type="submit"
        data-testid="save-button"
        class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        :disabled="mutationBusy"
      >
        {{ submitting ? '저장 중' : '저장' }}
      </button>
      <button
        v-if="isDirty"
        type="button"
        data-testid="cancel-button"
        class="rounded-md bg-line px-3 py-2 text-sm font-medium text-ink"
        :disabled="mutationBusy"
        @click="resetFromSnapshot"
      >
        취소
      </button>
      <template v-if="savedBanner">
        <button
          type="button"
          data-testid="status-enable"
          class="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white"
          :disabled="mutationBusy"
          @click="changeStatus(true)"
        >
          사용
        </button>
        <button
          type="button"
          data-testid="status-disable"
          class="rounded-md bg-background-light px-3 py-2 text-sm font-medium text-ink"
          :disabled="mutationBusy"
          @click="changeStatus(false)"
        >
          사용 안 함
        </button>
      </template>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useAdminAffiliateBanners } from '~/composables/useAdminAffiliateBanners'
import type {
  AffiliateBannerDraft,
  AffiliateBannerDto,
  AffiliateProvider,
} from '~/types/affiliateBanner'

type PreviewState = 'idle' | 'loading' | 'loaded' | 'error'

const props = defineProps<{ banner: AffiliateBannerDto | null }>()
const emit = defineEmits<{
  saved: [dto: AffiliateBannerDto]
  'dirty-change': [value: boolean]
}>()

const providers: Record<AffiliateProvider, string> = {
  coupang: '쿠팡',
  ali: '알리',
  toss: '토스',
}

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const maxUploadBytes = 2 * 1024 * 1024
const api = useAdminAffiliateBanners()

const draft = reactive<AffiliateBannerDraft>(emptyDraft())
const savedBanner = ref<AffiliateBannerDto | null>(null)
const snapshot = ref('')
const altTextEdited = ref(false)
const submitting = ref(false)
const uploading = ref(false)
const statusChanging = ref(false)
const message = ref('')
const imageGeneration = ref(0)
const uploadRequestId = ref(0)
const statusRequestId = ref(0)
const applyingDraft = ref(false)
const preview = ref<{ generation: number; src: string } | null>(null)
const previewState = ref<PreviewState>('idle')

const providerLabel = computed(() => providers[draft.provider])
const canonicalDraft = computed(() => canonicalize(draft))
const isDirty = computed(() => canonicalDraft.value !== snapshot.value)
const inputLocked = computed(() => submitting.value || statusChanging.value)
const mutationBusy = computed(() => submitting.value || uploading.value || statusChanging.value)
const imageChanged = computed(() => {
  if (!savedBanner.value) return false
  return draft.imageSourceType !== savedBanner.value.imageSourceType
    || draft.imageAssetId !== savedBanner.value.imageAssetId
    || draft.externalImageUrl !== savedBanner.value.externalImageUrl
})
const previewStateLabel = computed(() => {
  if (previewState.value === 'loading') return '이미지 확인 중'
  if (previewState.value === 'loaded') return '이미지를 불러왔습니다'
  if (previewState.value === 'error') return '이미지를 불러올 수 없습니다'
  return '대기 중'
})

watch(
  () => props.banner,
  (banner) => {
    savedBanner.value = banner ? cloneBanner(banner) : null
    uploadRequestId.value += 1
    statusRequestId.value += 1
    uploading.value = false
    statusChanging.value = false
    assignDraft(banner ? fromBanner(banner) : emptyDraft())
    snapshot.value = canonicalDraft.value
    altTextEdited.value = Boolean(banner?.altText)
    message.value = ''
    setPreviewFromImage(banner?.imageUrl ?? null)
    emit('dirty-change', false)
  },
  { immediate: true }
)

watch(
  () => draft.name,
  (name) => {
    if (!altTextEdited.value) draft.altText = name
  }
)

watch(
  () => draft.altText,
  (value, oldValue) => {
    if (oldValue !== undefined && value !== draft.name) altTextEdited.value = true
  }
)

watch(
  () => draft.imageSourceType,
  (source) => {
    if (applyingDraft.value) return
    message.value = ''
    if (source === 'upload') {
      draft.externalImageUrl = null
    } else {
      draft.imageAssetId = null
    }
    invalidatePreview()
  }
)

watch(
  () => draft.externalImageUrl,
  () => {
    if (applyingDraft.value) return
    if (draft.imageSourceType !== 'url') return
    invalidatePreview()
  }
)

watch(isDirty, (value) => emit('dirty-change', value))

function emptyDraft(): AffiliateBannerDraft {
  return {
    provider: 'coupang',
    name: '',
    imageSourceType: 'url',
    imageAssetId: null,
    externalImageUrl: null,
    targetUrl: '',
    altText: '',
  }
}

function fromBanner(banner: AffiliateBannerDto): AffiliateBannerDraft {
  return {
    provider: banner.provider,
    name: banner.name,
    imageSourceType: banner.imageSourceType,
    imageAssetId: banner.imageAssetId,
    externalImageUrl: banner.externalImageUrl,
    targetUrl: banner.targetUrl,
    altText: banner.altText,
  }
}

function cloneBanner(banner: AffiliateBannerDto): AffiliateBannerDto {
  return { ...banner }
}

function assignDraft(next: AffiliateBannerDraft) {
  applyingDraft.value = true
  draft.provider = next.provider
  draft.name = next.name
  draft.imageSourceType = next.imageSourceType
  draft.imageAssetId = next.imageAssetId
  draft.externalImageUrl = next.externalImageUrl
  draft.targetUrl = next.targetUrl
  draft.altText = next.altText
  void nextTick(() => {
    applyingDraft.value = false
  })
}

function canonicalize(value: AffiliateBannerDraft): string {
  return JSON.stringify({
    provider: value.provider,
    name: value.name,
    imageSourceType: value.imageSourceType,
    imageAssetId: value.imageSourceType === 'upload' ? value.imageAssetId : null,
    externalImageUrl: value.imageSourceType === 'url' ? value.externalImageUrl : null,
    targetUrl: value.targetUrl,
    altText: value.altText,
  })
}

function toRequestDraft(): AffiliateBannerDraft {
  return {
    provider: draft.provider,
    name: draft.name,
    imageSourceType: draft.imageSourceType,
    imageAssetId: draft.imageSourceType === 'upload' ? draft.imageAssetId : null,
    externalImageUrl: draft.imageSourceType === 'url' ? draft.externalImageUrl : null,
    targetUrl: draft.targetUrl,
    altText: draft.altText,
  }
}

function invalidatePreview() {
  imageGeneration.value += 1
  uploadRequestId.value += 1
  uploading.value = false
  preview.value = null
  previewState.value = 'idle'
}

function setPreviewFromImage(
  imageUrl: string | null,
  verifiedPreview?: { src: string; state: PreviewState } | null
) {
  imageGeneration.value += 1
  if (!imageUrl) {
    preview.value = null
    previewState.value = 'idle'
    return
  }

  preview.value = { generation: imageGeneration.value, src: imageUrl }
  previewState.value = verifiedPreview?.src === imageUrl && verifiedPreview.state === 'loaded'
    ? 'loaded'
    : 'loading'
}

function startUrlPreview() {
  if (draft.imageSourceType !== 'url' || !draft.externalImageUrl) return
  imageGeneration.value += 1
  preview.value = { generation: imageGeneration.value, src: draft.externalImageUrl }
  previewState.value = 'loading'
  message.value = ''
}

function onPreviewResult(generation: number, result: 'loaded' | 'error') {
  if (generation !== imageGeneration.value) return
  previewState.value = result
}

async function onFileChange(event: Event) {
  if (inputLocked.value) return
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  imageGeneration.value += 1
  uploadRequestId.value += 1
  const generation = imageGeneration.value
  const requestId = uploadRequestId.value
  preview.value = null
  previewState.value = 'idle'
  message.value = ''

  if (!allowedTypes.has(file.type)) {
    message.value = 'JPEG, PNG, WebP, GIF 파일만 업로드할 수 있습니다'
    return
  }
  if (file.size > maxUploadBytes) {
    message.value = '이미지는 최대 2 MiB까지 업로드할 수 있습니다'
    return
  }

  uploading.value = true
  try {
    const uploaded = await api.uploadImage(file)
    if (requestId !== uploadRequestId.value || generation !== imageGeneration.value) return
    draft.imageSourceType = 'upload'
    draft.imageAssetId = uploaded.imageAssetId
    draft.externalImageUrl = null
    preview.value = { generation, src: uploaded.imageUrl }
    previewState.value = 'loading'
  } catch {
    if (requestId === uploadRequestId.value && generation === imageGeneration.value) {
      message.value = '이미지를 업로드하지 못했습니다'
    }
  } finally {
    if (requestId === uploadRequestId.value) uploading.value = false
  }
}

async function save() {
  if (mutationBusy.value) return
  if (savedBanner.value?.isEnabled && imageChanged.value && previewState.value === 'error') {
    message.value = '기존 활성 배너는 편집을 취소하고 사용 안 함으로 전환한 뒤 이미지를 바꾸세요'
    return
  }

  submitting.value = true
  message.value = ''
  const currentPreview = preview.value
  const currentPreviewState = previewState.value
  try {
    const request = toRequestDraft()
    const dto = savedBanner.value
      ? await api.update(savedBanner.value.id, request)
      : await api.create(request)
    savedBanner.value = cloneBanner(dto)
    assignDraft(fromBanner(dto))
    snapshot.value = canonicalDraft.value
    altTextEdited.value = Boolean(dto.altText)
    setPreviewFromImage(
      dto.imageUrl,
      currentPreview ? { src: currentPreview.src, state: currentPreviewState } : null
    )
    emit('saved', dto)
    emit('dirty-change', false)
  } catch {
    message.value = '저장하지 못했습니다'
  } finally {
    submitting.value = false
  }
}

async function changeStatus(isEnabled: boolean) {
  if (mutationBusy.value) return
  if (!savedBanner.value) return
  message.value = ''
  if (isDirty.value) {
    message.value = '변경 내용을 먼저 저장하거나 취소하세요'
    return
  }
  if (isEnabled && previewState.value !== 'loaded') {
    message.value = '이미지를 불러올 수 없습니다'
    return
  }

  const requestId = statusRequestId.value + 1
  statusRequestId.value = requestId
  const bannerId = savedBanner.value.id
  statusChanging.value = true
  try {
    const dto = await api.setStatus(bannerId, isEnabled)
    if (requestId !== statusRequestId.value || savedBanner.value?.id !== bannerId) return
    savedBanner.value = cloneBanner(dto)
    assignDraft(fromBanner(dto))
    snapshot.value = canonicalDraft.value
    emit('saved', dto)
    emit('dirty-change', false)
  } catch {
    if (requestId === statusRequestId.value) {
      message.value = '상태를 변경하지 못했습니다'
    }
  } finally {
    if (requestId === statusRequestId.value) statusChanging.value = false
  }
}

function resetFromSnapshot() {
  const parsed = JSON.parse(snapshot.value) as AffiliateBannerDraft
  assignDraft(parsed)
  message.value = ''
  setPreviewFromImage(savedBanner.value?.imageUrl ?? null)
}

async function copyTargetUrl() {
  if (!draft.targetUrl) return
  if (
    (import.meta as ImportMeta & { client?: boolean }).client === false
    || typeof navigator === 'undefined'
    || typeof navigator.clipboard?.writeText !== 'function'
  ) {
    message.value = '복사하지 못했습니다. 주소를 직접 복사하세요'
    return
  }
  try {
    await navigator.clipboard.writeText(draft.targetUrl)
    message.value = ''
  } catch {
    message.value = '복사하지 못했습니다. 주소를 직접 복사하세요'
  }
}
</script>
