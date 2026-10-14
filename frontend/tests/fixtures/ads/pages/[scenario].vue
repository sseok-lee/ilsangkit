<script setup lang="ts">
import AdBanner from '../../../../components/ads/AdBanner.vue'
const route = useRoute()
const scenario = computed(() => String(route.params.scenario))
const fixed = computed(() => scenario.value.startsWith('fixed') || scenario.value === 'density')
const show = ref(true)
const suppressed = useState('ads:suppressed', () => false)
</script>
<template>
  <main>
    <nav>
      <NuxtLink to="/fixed">first</NuxtLink><NuxtLink to="/fixed-next">next</NuxtLink
      ><NuxtLink to="/fixed-third">third</NuxtLink>
      <button id="toggle" @click="show = !show">toggle</button>
      <button id="suppress" @click="suppressed = !suppressed">suppress</button>
    </nav>
    <div id="before">Before the advertisement</div>
    <section>
      <AdBanner
        v-if="show"
        class="my-4"
        :sizing="fixed ? 'fixed' : 'min'"
        :ad-format="fixed ? 'rectangle' : 'auto'"
        :fixed-height="fixed ? 280 : undefined"
      />
    </section>
    <div id="after">Content after the advertisement</div>
    <template v-if="scenario === 'density'">
      <AdBanner />
      <div class="content">Article content</div>
      <AdBanner />
      <div class="content">More content</div>
      <AdBanner />
    </template>
  </main>
</template>
<style>
body {
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
#before {
  height: 80px;
}
section {
  display: flow-root;
}
#after,
.content {
  height: 180px;
}
</style>
