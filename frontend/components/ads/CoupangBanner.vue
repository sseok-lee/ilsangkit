<template>
  <div class="w-full">
    <ClientOnly>
      <div ref="wrapRef" class="w-full min-h-[140px] overflow-hidden" />
    </ClientOnly>
    <p class="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
      이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

const wrapRef = ref<HTMLDivElement | null>(null)
let active = true

onMounted(async () => {
  if (!import.meta.client) return
  await nextTick()
  if (!wrapRef.value) return

  const G_JS = 'https://ads-partners.coupang.com/g.js'

  const init = () => {
    if (!active || !wrapRef.value) return
    const script = document.createElement('script')
    script.textContent = `new PartnersCoupang.G({"id":985751,"template":"carousel","trackingCode":"AF5459655","width":"680","height":"140","tsource":""})`
    wrapRef.value.appendChild(script)
  }

  if (document.querySelector(`script[src="${G_JS}"]`)) {
    init()
  } else {
    const loader = document.createElement('script')
    loader.src = G_JS
    loader.onload = init
    document.head.appendChild(loader)
  }
})

onBeforeUnmount(() => { active = false })
</script>
