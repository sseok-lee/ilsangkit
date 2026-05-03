<template>
  <ClientOnly>
    <div ref="wrapRef" class="w-full overflow-hidden" />
  </ClientOnly>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const wrapRef = ref<HTMLDivElement | null>(null)
let active = true

onMounted(() => {
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
