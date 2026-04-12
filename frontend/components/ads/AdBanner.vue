<template>
  <div v-if="!adError" class="ad-banner my-6">
    <ClientOnly>
      <div ref="adContainer" class="flex justify-center min-h-[100px]">
        <ins
          class="adsbygoogle"
          style="display: block"
          :data-ad-client="AD_CLIENT"
          :data-ad-slot="adSlot"
          :data-ad-format="adFormat"
          :data-full-width-responsive="fullWidthResponsive"
        />
      </div>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
const AD_CLIENT = 'ca-pub-2088264360250020'

withDefaults(defineProps<{
  adSlot?: string
  adFormat?: string
  fullWidthResponsive?: string
}>(), {
  adSlot: '1878068382',
  adFormat: 'auto',
  fullWidthResponsive: 'true',
})

const adContainer = ref<HTMLElement | null>(null)
const adError = ref(false)

onMounted(() => {
  try {
    const adsbygoogle = (window as any).adsbygoogle || []
    adsbygoogle.push({})
  } catch {
    adError.value = true
  }
})
</script>
