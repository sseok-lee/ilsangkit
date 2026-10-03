<template>
  <div class="subscription-hub bg-white text-ink" :aria-busy="pending ? 'true' : 'false'">
    <div class="page-container pt-3 md:pt-5 pb-14">
      <PageHead
        eyebrow="청약"
        title="청약·임대, 신청할 공고부터."
        description="한국부동산원 청약홈, 마이홈·LH, 민간 분양사가 제공하는 청약·임대 공고를 분양과 임대로 나눠 접수 상태와 공급 규모 중심으로 확인하세요."
      />

      <SubscriptionNav />

      <section class="ongoing-panels" aria-labelledby="ongoing-title">
        <div class="section-heading">
          <div>
            <h2 id="ongoing-title">접수 중 공고</h2>
            <p>마감일이 가까운 분양과 공공임대를 나눠 보여줍니다.</p>
          </div>
        </div>

        <div class="ongoing-grid">
          <article
            v-for="panel in ongoingPanels"
            :key="panel.key"
            class="hub-panel"
            :data-panel="panel.key"
          >
            <header class="panel-header">
              <div>
                <h3>{{ panel.title }}</h3>
                <p>{{ panel.description }}</p>
              </div>
              <NuxtLink :to="panel.href" class="control-link">
                전체 보기
              </NuxtLink>
            </header>

            <div class="panel-total" :class="{ 'is-error': panel.data.error }">
              <strong>{{ totalLabel(panel.data.total, panel.data.error) }}</strong>
              <span>{{ panel.totalCaption }}</span>
            </div>

            <div v-if="panel.data.error" class="state-box" role="status">
              <p>{{ panel.title }} 정보를 불러오지 못했습니다.</p>
              <button type="button" class="text-button" @click="refresh">
                다시 불러오기
              </button>
            </div>
            <div v-else-if="panel.data.items.length === 0" class="state-box">
              <p>현재 접수 중인 {{ panel.title }} 공고가 없습니다.</p>
              <NuxtLink :to="panel.href" class="text-button">
                전체 목록 보기
              </NuxtLink>
            </div>
            <div v-else class="notice-list">
              <SubscriptionNoticeRow
                v-for="item in panel.data.items"
                :key="item.id"
                :item="item"
                layout="panel"
              />
            </div>
          </article>
        </div>
      </section>

      <AdBanner class="hub-ad" />

      <div class="upcoming-guide-grid">
        <section class="upcoming-panel" aria-labelledby="upcoming-title">
          <div class="section-heading">
            <div>
              <h2 id="upcoming-title">접수 예정</h2>
              <p>시작일이 가까운 분양·임대 공고 4건입니다.</p>
            </div>
            <div class="upcoming-actions">
              <NuxtLink to="/subscription/sale?status=upcoming" class="control-link">
                분양 예정 더보기
              </NuxtLink>
              <NuxtLink to="/subscription/rent?status=upcoming" class="control-link">
                임대 예정 더보기
              </NuxtLink>
            </div>
          </div>

          <div class="panel-total" :class="{ 'is-error': upcoming.error }">
            <strong>{{ totalLabel(upcoming.total, upcoming.error) }}</strong>
            <span>전체 접수 예정 공고</span>
          </div>

          <div v-if="upcoming.error" class="state-box" role="status">
            <p>접수 예정 공고를 불러오지 못했습니다.</p>
            <button type="button" class="text-button" @click="refresh">
              다시 불러오기
            </button>
          </div>
          <div v-else-if="upcoming.items.length === 0" class="state-box">
            <p>현재 접수 예정 공고가 없습니다.</p>
            <div class="empty-actions">
              <NuxtLink to="/subscription/sale?status=upcoming" class="text-button">
                분양 예정 보기
              </NuxtLink>
              <NuxtLink to="/subscription/rent?status=upcoming" class="text-button">
                임대 예정 보기
              </NuxtLink>
            </div>
          </div>
          <div v-else class="notice-list">
            <SubscriptionNoticeRow
              v-for="item in upcoming.items"
              :key="item.id"
              :item="item"
              show-category
            />
          </div>
        </section>

        <section class="type-guide" aria-labelledby="type-guide-title">
          <div class="section-heading">
            <div>
              <h2 id="type-guide-title">유형 안내</h2>
              <p>실제 제공 중인 분양·임대 경로로 이동합니다.</p>
            </div>
          </div>

          <div class="guide-links">
            <NuxtLink
              v-for="link in typeLinks"
              :key="link.to"
              :to="link.to"
              class="guide-link"
            >
              <strong>{{ link.title }}</strong>
              <span>{{ link.description }}</span>
            </NuxtLink>
          </div>
        </section>
      </div>

      <section class="hub-faq" aria-labelledby="faq-title">
        <div class="section-heading">
          <div>
            <h2 id="faq-title">자주 묻는 질문</h2>
          </div>
        </div>
        <div class="faq-list">
          <details v-for="faq in faqs" :key="faq.question">
            <summary>{{ faq.question }}</summary>
            <p>{{ faq.answer }}</p>
          </details>
        </div>
      </section>

      <section class="data-source" aria-labelledby="source-title">
        <div class="section-heading">
          <div>
            <h2 id="source-title">출처</h2>
            <p>분양·민영주택 청약 정보는 한국부동산원 청약Home(applyhome.co.kr) 공개 API 기준입니다.</p>
          </div>
        </div>
        <DataSourceSection variant="flat" domain="subscription" />
        <p class="source-copy">
          공공임대(마이홈·LH) 공고는 각 공급기관 원문을 기준으로 합니다.
          실제 신청 전 반드시 청약Home·마이홈·LH 또는 해당 공급기관의 최신 공고를 확인하세요.
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import PageHead from '~/components/common/PageHead.vue'
import { useAnalytics } from '~/composables/useAnalytics'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { useSubscriptionHub, type SubscriptionHubPanel } from '~/composables/useSubscriptionHub'
import { SITE_URL } from '~/utils/seoConstants'
import { SUBSCRIPTION_HUB_DESCRIPTION } from '~/utils/subscriptionMeta'

const { sale, publicRent, upcoming, pending, refresh } = await useSubscriptionHub()

const faqs = [
  { question: '청약 신청은 어디에서 하나요?', answer: '공고 상세에서 모집공고 원문과 안내된 공식 신청처를 확인하세요. 일상킷에서는 신청을 접수하지 않습니다.' },
  { question: '일정 확인 필요는 무슨 뜻인가요?', answer: '확인된 접수 일정이 없는 공고입니다. 모집공고 원문에서 접수기간을 확인하세요.' },
  { question: '지역을 선택하면 공급수도 달라지나요?', answer: '해당 지역을 포함한 공고를 찾습니다. 표시된 공급수와 기간은 공고 전체 기준이며 세부 공급정보는 상세에서 확인하세요.' },
]

const ongoingPanels = computed(() => [
  {
    key: 'sale',
    title: '분양',
    description: '아파트·오피스텔·무순위·임의공급',
    href: '/subscription/sale?status=ongoing',
    totalCaption: '전체 접수 중 분양',
    data: sale.value,
  },
  {
    key: 'public-rent',
    title: '공공임대',
    description: '청약홈·마이홈·LH 공공임대',
    href: '/subscription/rent/public?status=ongoing',
    totalCaption: '전체 접수 중 공공임대',
    data: publicRent.value,
  },
])

const typeLinks = [
  { to: '/subscription/sale', title: '분양', description: '아파트·오피스텔·무순위·임의공급' },
  { to: '/subscription/rent/public', title: '공공임대', description: '마이홈·LH를 포함한 공공임대주택' },
  { to: '/subscription/rent/private', title: '민간임대', description: '공공지원 민간임대 모집공고' },
]

function totalLabel(total: SubscriptionHubPanel['total'], error: boolean): string {
  if (error) return '조회 실패'
  if (total === null) return '원문 확인'
  return `${total.toLocaleString('ko-KR')}건`
}

const { setMeta } = useFacilityMeta()
setMeta({
  title: '청약 일정·분양정보',
  description: SUBSCRIPTION_HUB_DESCRIPTION,
  path: '/subscription',
})

const { setFAQSchema, setBreadcrumbSchema } = useStructuredData()
setFAQSchema(faqs.map(f => ({ question: f.question, answer: f.answer })))
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
])

const { trackSubscriptionListView } = useAnalytics()
onMounted(() => trackSubscriptionListView({ listType: 'hub' }))
</script>

<style scoped>
.subscription-hub {
  min-height: 100vh;
  background: rgb(var(--surface-rgb));
  color: rgb(var(--ink-rgb));
}

.section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
}

.section-heading h2 {
  margin: 0;
  color: rgb(var(--ink-rgb));
  font-size: 22px;
  font-weight: 730;
  letter-spacing: 0;
}

.section-heading p {
  margin: 6px 0 0;
  color: rgb(var(--muted-rgb));
  font-size: 14px;
  line-height: 1.55;
}

.ongoing-panels,
.upcoming-guide-grid,
.type-guide,
.hub-faq,
.data-source {
  margin-top: 34px;
}

.ongoing-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px;
}

.hub-panel,
.upcoming-panel,
.type-guide,
.hub-faq,
.data-source {
  min-width: 0;
}

.hub-panel {
  background: transparent;
  border: 0;
  border-radius: 0;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 20px 18px 16px;
  border-bottom: 1px solid rgb(var(--border-rgb));
}

.panel-header h3 {
  margin: 0;
  color: rgb(var(--ink-rgb));
  font-size: 19px;
  font-weight: 730;
  letter-spacing: 0;
}

.panel-header p {
  margin: 6px 0 0;
  color: rgb(var(--muted-rgb));
  font-size: 13px;
  line-height: 1.45;
}

.control-link,
.text-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  border: 0;
  background: transparent;
  color: rgb(var(--brand-rgb));
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.control-link:hover,
.text-button:hover {
  text-decoration: underline;
}

.panel-total {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 14px 18px 10px;
  background: transparent;
  border-bottom: 0;
}

.panel-total strong {
  color: rgb(var(--brand-rgb));
  font-size: 20px;
  font-weight: 760;
}

.panel-total span {
  color: rgb(var(--muted-rgb));
  font-size: 13px;
}

.panel-total.is-error strong {
  color: #9a3412;
}

.notice-list {
  background: rgb(var(--surface-rgb));
}

.state-box {
  padding: 28px 18px 30px;
  text-align: center;
}

.state-box p {
  margin: 0;
  color: rgb(var(--muted-rgb));
  font-size: 14px;
  line-height: 1.6;
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px 16px;
}

.upcoming-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 18px;
}

.upcoming-panel,
.type-guide,
.hub-faq,
.data-source {
  background: transparent;
  border: 0;
  border-radius: 0;
  padding: 0;
}

.upcoming-guide-grid {
  display: grid;
  grid-template-columns: minmax(0, 2.1fr) minmax(280px, 0.9fr);
  gap: 56px;
  align-items: start;
  padding-top: 10px;
}

.guide-links {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  border-top: 1px solid rgb(var(--border-rgb));
}

.guide-link {
  display: flex;
  min-height: 92px;
  flex-direction: column;
  justify-content: center;
  gap: 7px;
  padding: 16px 0;
  border-bottom: 1px solid rgb(var(--border-rgb));
  color: rgb(var(--ink-rgb));
  text-decoration: none;
}

.guide-link:hover {
  color: rgb(var(--brand-rgb));
}

.guide-link strong {
  font-size: 16px;
}

.guide-link span {
  color: rgb(var(--muted-rgb));
  font-size: 13px;
  line-height: 1.5;
}

.faq-list {
  border-top: 1px solid rgb(var(--border-rgb));
}

.faq-list details {
  border-bottom: 1px solid rgb(var(--border-rgb));
}

.faq-list summary {
  min-height: 44px;
  padding: 14px 0;
  color: rgb(var(--ink-rgb));
  cursor: pointer;
  font-size: 15px;
  font-weight: 650;
}

.faq-list p {
  margin: 0;
  padding: 0 0 16px;
  color: rgb(var(--muted-rgb));
  font-size: 14px;
  line-height: 1.7;
}

.source-copy {
  margin: 14px 0 0;
  color: rgb(var(--muted-rgb));
  font-size: 13px;
  line-height: 1.65;
}

.hub-ad {
  margin-top: 42px;
}

@media (min-width: 769px) {
  .ongoing-grid {
    gap: 0;
    border-top: 0;
  }

  .hub-panel {
    border: 0;
    border-radius: 0;
    background: transparent;
    overflow: visible;
  }

  .hub-panel:first-child {
    padding-right: 32px;
  }

  .hub-panel + .hub-panel {
    padding-left: 32px;
    border-left: 1px solid rgb(var(--border-rgb));
  }

  .panel-header {
    padding: 0 0 16px;
    border-bottom: 0;
  }

  .panel-total {
    padding: 0 0 12px;
    border-bottom: 0;
    background: transparent;
  }

  .notice-list {
    background: transparent;
  }
}

@media (max-width: 768px) {
  .section-heading {
    display: block;
  }

  .section-heading .control-link {
    margin-top: 8px;
  }

  .ongoing-grid,
  .upcoming-guide-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 30px;
  }

  .panel-header {
    padding: 18px 0 14px;
  }

  .hub-panel {
    padding: 0 16px;
  }

  .panel-total {
    margin: 0 -16px;
    padding: 13px 16px;
  }

  .hub-ad {
    margin-top: 30px;
  }
}
</style>
