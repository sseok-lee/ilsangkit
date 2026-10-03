<template>
  <nav class="subscription-nav" aria-label="청약 주요 경로">
    <NuxtLink
      v-for="link in links"
      :key="link.path"
      :to="{ path: link.path, query: link.query }"
      class="subscription-nav__link"
      :class="{ 'subscription-nav__link--active': route.path === link.path }"
    >
      {{ link.label }}
    </NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import type { SubscriptionListFilters } from '~/types/subscriptionList'
import { normalizeSubscriptionQuery, subscriptionScopeForPath } from '~/utils/subscriptionListQuery'

const props = defineProps<{
  filters?: SubscriptionListFilters
}>()

const route = useRoute()

const baseLinks = [
  { label: '한눈에 보기', path: '/subscription' },
  { label: '분양', path: '/subscription/sale' },
  { label: '임대', path: '/subscription/rent' },
]

const links = computed(() => baseLinks.map((link) => {
  const scope = subscriptionScopeForPath(link.path)
  const query = props.filters && scope
    ? normalizeSubscriptionQuery(props.filters, scope, []).query as LocationQueryRaw
    : {}
  return { ...link, query }
}))
</script>

<style scoped>
.subscription-nav {
  display: flex;
  gap: 30px;
  border-bottom: 1px solid rgb(var(--border-rgb));
  margin-bottom: 30px;
}

.subscription-nav__link {
  display: block;
  padding: 12px 2px 14px;
  margin-bottom: -1px;
  border-bottom: 3px solid transparent;
  color: rgb(var(--ink-rgb));
  font-size: 17px;
  font-weight: 650;
}

.subscription-nav__link--active {
  border-color: rgb(var(--brand-rgb));
  color: rgb(var(--brand-rgb));
}

@media (max-width: 700px) {
  .subscription-nav {
    gap: 28px;
    margin-bottom: 24px;
  }

  .subscription-nav__link {
    padding: 9px 0 12px;
    font-size: 16px;
  }
}
</style>
