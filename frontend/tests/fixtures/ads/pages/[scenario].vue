<script setup lang="ts">
import AdBanner from '../../../../components/ads/AdBanner.vue'
const route = useRoute()
const scenario = computed(() => String(route.params.scenario))
const show = ref(true)
const suppressed = useState('ads:suppressed', () => false)
</script>
<template>
  <main>
    <nav>
      <NuxtLink to="/default" no-prefetch>first</NuxtLink>
      <NuxtLink to="/default-next" no-prefetch>next</NuxtLink>
      <NuxtLink to="/default-third" no-prefetch>third</NuxtLink>
      <button id="toggle" @click="show = !show">toggle</button>
      <button id="suppress" @click="suppressed = !suppressed">suppress</button>
    </nav>
    <div id="measurement">
      <div id="before">Before the advertisement</div>
      <section v-if="show" id="primary">
        <AdBanner v-if="scenario === 'auto'" class="my-4" ad-format="auto" />
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
    <template v-if="scenario === 'density'">
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
