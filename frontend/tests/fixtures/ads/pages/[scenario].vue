<script setup lang="ts">
import AdBanner from '../../../../components/ads/AdBanner.vue'
const route = useRoute()
const scenario = computed(() => String(route.params.scenario))
const fixedMobile = computed(() => scenario.value.startsWith('fixed-mobile'))
const contentWidth = ref<string>()
const show = ref(true)
const suppressed = useState('ads:suppressed', () => false)
</script>
<template>
  <main
    :class="{ 'fixed-mobile': fixedMobile }"
    :style="contentWidth ? { width: contentWidth } : undefined"
  >
    <nav>
      <NuxtLink :to="fixedMobile ? '/fixed-mobile' : '/default'" no-prefetch>first</NuxtLink>
      <NuxtLink :to="fixedMobile ? '/fixed-mobile-next' : '/default-next'" no-prefetch>
        next
      </NuxtLink>
      <NuxtLink :to="fixedMobile ? '/fixed-mobile-third' : '/default-third'" no-prefetch>
        third
      </NuxtLink>
      <button id="toggle" @click="show = !show">toggle</button>
      <button id="suppress" @click="suppressed = !suppressed">suppress</button>
    </nav>
    <div v-if="fixedMobile" id="width-controls">
      <button
        v-for="width in [319.75, 320, 319]"
        :id="`width-${width}`"
        :key="width"
        @click="contentWidth = `${width}px`"
      >
        {{ width }}
      </button>
    </div>
    <div id="measurement">
      <div id="before">Before the advertisement</div>
      <div v-if="scenario === 'fixed-mobile-far'" id="spacer"></div>
      <section v-if="show" id="primary">
        <AdBanner
          v-if="fixedMobile"
          variant="mobile-banner-320x100"
          only="mobile"
          class="fixture-header-ad"
          data-testid="building-header-ad"
        />
        <AdBanner v-else-if="scenario === 'auto'" class="my-4" ad-format="auto" />
        <AdBanner v-else-if="scenario === 'horizontal'" class="my-4" ad-format="horizontal" />
        <AdBanner v-else-if="scenario === 'rectangle'" class="my-4" ad-format="rectangle" />
        <AdBanner v-else-if="scenario === 'compact'" class="my-4" variant="compact-mobile" />
        <AdBanner v-else-if="scenario === 'first'" class="my-4" full-width-responsive="false" />
        <AdBanner v-else class="my-4" />
      </section>
      <template v-if="scenario === 'lazy'">
        <div id="spacer"></div>
        <section id="secondary"><AdBanner /></section>
      </template>
      <div id="after">Content after the advertisement</div>
    </div>
    <AdBanner
      v-if="scenario === 'fixed-mobile-siblings'"
      data-testid="legacy-first"
      full-width-responsive="false"
    />
    <template v-if="scenario === 'density' || scenario === 'fixed-mobile-siblings'">
      <AdBanner />
      <div class="content">Article content</div>
      <AdBanner />
      <div class="content">More content</div>
      <AdBanner />
    </template>
    <template v-if="scenario === 'spacing'">
      <section id="flow-spacing">
        <AdBanner class="mt-6" />
        <div>Flow content</div>
      </section>
      <section id="estate-spacing" class="estate">
        <AdBanner />
        <div>Estate content</div>
      </section>
      <section id="grid-spacing" class="spaced-grid">
        <AdBanner />
        <div>Grid content</div>
      </section>
      <section id="flex-spacing" class="spaced-flex">
        <AdBanner />
        <div>Flex content</div>
      </section>
    </template>
  </main>
</template>
<style>
body {
  --ad-fixture-ready: 1;
  margin: 0;
  font-family: Arial, sans-serif;
}
main {
  width: calc(100% - 32px);
  max-width: 900px;
  margin: auto;
}
main.fixed-mobile {
  width: calc(100% - 40px);
}
.fixed-mobile #after {
  margin-top: 22px;
}
.fixture-header-ad {
  margin-top: 16px;
  margin-bottom: 0;
}
#width-controls {
  height: 24px;
}
nav {
  height: 44px;
  display: flex;
  gap: 8px;
}
#measurement {
  display: flex;
  flex-direction: column;
  gap: 0;
}
#before {
  height: 80px;
}
section {
  display: flow-root;
}
#spacer {
  height: calc(100vh + 350px);
  flex-shrink: 0;
}
#after,
.content {
  height: 180px;
}
.spaced-grid {
  display: grid;
  gap: 30px;
}
.spaced-flex {
  display: flex;
  flex-direction: column;
  gap: 26px;
}
</style>
<style scoped>
.estate :deep(.ad-banner) {
  margin-top: 18px;
  margin-bottom: 22px;
}
</style>
