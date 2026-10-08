<template>
  <section
    v-if="shouldRender"
    data-testid="affiliate-banner"
    class="affiliate-banner my-6 w-full"
    aria-label="제휴 광고"
  >
    <p
      data-testid="affiliate-disclosure"
      class="affiliate-banner__disclosure whitespace-pre-line break-words"
    >
      {{ currentBanner?.disclosureText }}
    </p>
    <a
      data-testid="affiliate-link"
      class="affiliate-banner__link"
      :href="currentBanner?.targetUrl"
      target="_blank"
      rel="sponsored nofollow noopener noreferrer"
    >
      <span class="affiliate-banner__image-frame">
        <img
          data-testid="affiliate-image"
          class="affiliate-banner__image"
          :src="resolvedImageUrl"
          :alt="currentBanner?.altText"
          loading="lazy"
          decoding="async"
          @error="handleImageError"
        >
      </span>
    </a>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useApiBase } from '~/composables/useApiBase'
import { isAdFreePath } from '~/composables/useAdsPolicy'
import type { PublicAffiliateBanner, PublicAffiliateBannerResponse } from '~/types/publicAffiliateBanner'
import { getAffiliateExpiryWindow } from '~/utils/affiliateBannerExpiration'

const MOBILE_MEDIA = '(max-width: 767px)'
const MAX_TIMEOUT_MS = 2_147_483_647

const route = useRoute()
const apiBase = useApiBase()
const adsSuppressed = useState<boolean>('ads:suppressed', () => false)

const clientReady = ref(false)
const isMobile = ref(false)
const currentBanner = ref<PublicAffiliateBanner | null>(null)
const imageFailed = ref(false)

let mediaQuery: MediaQueryList | null = null
let requestGeneration = 0
let abortController: AbortController | null = null
let expiryTimer: ReturnType<typeof setTimeout> | null = null

const canRequest = computed(() => {
  const path = typeof route.path === 'string' ? route.path : ''
  return clientReady.value
    && isMobile.value
    && !adsSuppressed.value
    && !isAdFreePath(path)
})

const shouldRender = computed(() =>
  canRequest.value
  && currentBanner.value !== null
  && !imageFailed.value
)

const resolvedImageUrl = computed(() => {
  const imageUrl = currentBanner.value?.imageUrl ?? ''
  if (!imageUrl.startsWith('/api/images/')) return imageUrl
  return `${apiBase}${imageUrl}`
})

function isCompleteBanner(value: PublicAffiliateBanner | null): value is PublicAffiliateBanner {
  return Boolean(
    value
    && value.id
    && value.provider
    && value.imageUrl
    && value.targetUrl
    && value.altText
    && value.disclosureText
  )
}

function abortPendingRequest() {
  abortController?.abort()
  abortController = null
}

function clearExpiryTimer() {
  if (expiryTimer !== null) clearTimeout(expiryTimer)
  expiryTimer = null
}

function invalidateBanner() {
  clearExpiryTimer()
  requestGeneration += 1
  abortPendingRequest()
  currentBanner.value = null
  imageFailed.value = false
}

function scheduleExpiration(generation: number, deadline: number) {
  clearExpiryTimer()
  if (generation !== requestGeneration) return

  const remaining = deadline - performance.now()
  if (remaining <= 0) {
    invalidateBanner()
    return
  }

  expiryTimer = setTimeout(() => {
    if (generation !== requestGeneration) return
    expiryTimer = null
    scheduleExpiration(generation, deadline)
  }, Math.min(remaining, MAX_TIMEOUT_MS))
}

async function loadBanner() {
  invalidateBanner()
  if (!canRequest.value || document.visibilityState === 'hidden') return

  const generation = requestGeneration
  const controller = new AbortController()
  abortController = controller
  const startedAt = performance.now()

  try {
    const response = await $fetch<PublicAffiliateBannerResponse>(
      `${apiBase}/api/affiliate-banners/random`,
      { signal: controller.signal }
    )
    const receivedAt = performance.now()
    if (generation !== requestGeneration || controller.signal.aborted) return
    if (document.visibilityState === 'hidden') return
    if (!isCompleteBanner(response.data)) return

    const expiryWindow = getAffiliateExpiryWindow(
      response.data.expiresAt,
      response.serverTime,
      receivedAt - startedAt,
    )
    if (expiryWindow === null) return

    currentBanner.value = response.data
    if (expiryWindow.remainingMs !== null) {
      scheduleExpiration(generation, receivedAt + expiryWindow.remainingMs)
    }
  } catch {
    if (generation !== requestGeneration) return
    currentBanner.value = null
  } finally {
    if (abortController === controller) {
      abortController = null
    }
  }
}

function handleMediaChange(event?: MediaQueryListEvent) {
  isMobile.value = typeof event?.matches === 'boolean'
    ? event.matches
    : mediaQuery?.matches === true
}

function addMediaListener(query: MediaQueryList) {
  query.addEventListener?.('change', handleMediaChange)
  query.addListener?.(handleMediaChange)
}

function removeMediaListener(query: MediaQueryList) {
  query.removeEventListener?.('change', handleMediaChange)
  query.removeListener?.(handleMediaChange)
}

function handleImageError() {
  invalidateBanner()
}

function reloadAfterResume() {
  if (abortController !== null && !abortController.signal.aborted) return
  void loadBanner()
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') {
    invalidateBanner()
    return
  }
  reloadAfterResume()
}

function handlePageShow(event: PageTransitionEvent) {
  if (event.persisted && document.visibilityState === 'visible') reloadAfterResume()
}

onMounted(() => {
  mediaQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia(MOBILE_MEDIA)
    : null
  handleMediaChange()
  if (mediaQuery) addMediaListener(mediaQuery)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('pageshow', handlePageShow)
  clientReady.value = true
})

watch(
  () => [canRequest.value, route.path] as const,
  () => {
    void loadBanner()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  if (mediaQuery) removeMediaListener(mediaQuery)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('pageshow', handlePageShow)
  invalidateBanner()
})
</script>

<style>
.affiliate-banner {
  color: var(--muted);
}

.affiliate-banner__disclosure {
  margin: 0 auto 12px;
  max-width: 360px;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
  text-wrap: balance;
  word-break: keep-all;
}

.affiliate-banner__link {
  display: block;
  color: inherit;
  text-decoration: none;
}

.affiliate-banner__image-frame {
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(100%, 360px);
  aspect-ratio: 1 / 1;
  margin: 0 auto;
  overflow: hidden;
  background: var(--surface-2);
}

.affiliate-banner__image {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
