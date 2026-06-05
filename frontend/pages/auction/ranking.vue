<template>
  <div class="bg-background-light min-h-screen">
    <main class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <PageHero
        eyebrow="공매"
        title="지역별 낙찰가율 랭킹"
        description="지역별·용도별 공매 낙찰가율 통계를 확인하세요. 온비드 공식 데이터 기반."
      />

      <!-- 용도/정렬 토글 -->
      <div class="flex flex-wrap gap-2">
        <select
          v-model="selectedUsage"
          class="rounded-lg border border-line px-3 py-2 text-sm"
        >
          <option value="">전체 용도</option>
          <option v-for="[k, v] in usageOptions" :key="k" :value="k">{{ v }}</option>
        </select>
        <select
          v-model="selectedOrder"
          class="rounded-lg border border-line px-3 py-2 text-sm"
        >
          <option value="high">낙찰가율 높은 순</option>
          <option value="low">낙찰가율 낮은 순</option>
          <option value="count">낙찰 건수 많은 순</option>
        </select>
      </div>

      <!-- 랭킹 테이블 -->
      <div v-if="rows && rows.length > 0" class="bg-white rounded-xl border border-line shadow-card p-4">
        <AuctionRankingTable :rows="rows" />
      </div>
      <div v-else class="rounded-xl bg-slate-50 p-12 text-center">
        <p class="text-slate-500 text-sm">낙찰 데이터가 충분히 쌓이면 랭킹이 표시됩니다.</p>
      </div>

      <AdBanner />

      <section>
        <p class="text-caption text-slate-400">출처: 한국자산관리공사 온비드 (공공데이터포털)</p>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAuction } from '~/composables/useAuction'
import { USAGE_GROUP_LABEL } from '~/types/auction'
import { SITE_URL } from '~/utils/seoConstants'
import AuctionRankingTable from '~/components/auction/AuctionRankingTable.vue'
import PageHero from '~/components/common/PageHero.vue'

const auction = useAuction()

const selectedUsage = ref('')
const selectedOrder = ref('high')

const usageOptions = computed(() =>
  Object.entries(USAGE_GROUP_LABEL) as [string, string][],
)

const { data: rows, refresh } = await useAsyncData(
  'auction-ranking',
  async () => {
    try {
      return await auction.getRanking({ usage: selectedUsage.value || undefined, order: selectedOrder.value, limit: 50 })
    } catch {
      return []
    }
  },
  { default: () => [] },
)

watch([selectedUsage, selectedOrder], () => {
  refresh()
})

useHead({
  title: '지역별 낙찰가율 랭킹 | 공매 | 일상킷',
  meta: [
    { name: 'description', content: '지역별·용도별 공매 낙찰가율 통계를 확인하세요. 온비드 공식 데이터 기반.' },
    { property: 'og:title', content: '지역별 낙찰가율 랭킹 | 공매 | 일상킷' },
    { property: 'og:url', content: `${SITE_URL}/auction/ranking` },
  ],
  link: [{ rel: 'canonical', href: `${SITE_URL}/auction/ranking` }],
})
</script>
