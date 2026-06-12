<template>
  <div>
    <div class="flex items-center gap-2 mb-2 text-primary">
      <span class="material-symbols-outlined text-[20px]">schedule</span>
      <span class="text-sm font-semibold text-ink">주요 일정</span>
    </div>
    <div class="space-y-4">
      <TimelineItem
        v-if="subscription.announcementDate"
        title="모집공고"
        :date="subscription.announcementDate"
        icon="article"
      />
      <!-- 일반 청약 접수 기간: 순위/특별공급 일정이 없는 타입(오피스텔·무순위·임의공급 등)에서만 노출.
           APT 등 순위 데이터가 있으면 아래 특공/1순위/2순위 행과 중복되므로 숨긴다.
           무순위 상시 접수처럼 종료일이 없으면 시작일만 표시한다. -->
      <TimelineItem
        v-if="receptionDate && !hasRankSchedule"
        title="청약 접수"
        :date="receptionDate"
        icon="calendar_month"
      />
      <TimelineItem
        v-if="subscription.specialStartDate && subscription.specialEndDate"
        title="특별공급 접수"
        :date="`${subscription.specialStartDate} ~ ${subscription.specialEndDate}`"
        icon="edit_note"
      />
      <TimelineItem
        v-if="subscription.rank1AreaStartDate && subscription.rank1AreaEndDate"
        title="1순위 접수"
        :date="`${subscription.rank1AreaStartDate} ~ ${subscription.rank1AreaEndDate}`"
        icon="first_page"
      />
      <TimelineItem
        v-if="subscription.rank2AreaStartDate && subscription.rank2AreaEndDate"
        title="2순위 접수"
        :date="`${subscription.rank2AreaStartDate} ~ ${subscription.rank2AreaEndDate}`"
        icon="last_page"
      />
      <TimelineItem
        v-if="subscription.winnerDate"
        title="당첨자 발표"
        :date="subscription.winnerDate"
        icon="check_circle"
      />
      <TimelineItem
        v-if="subscription.contractStartDate && subscription.contractEndDate"
        title="계약 기간"
        :date="`${subscription.contractStartDate} ~ ${subscription.contractEndDate}`"
        icon="description"
      />
      <TimelineItem
        v-if="subscription.moveInMonth"
        title="입주 예정"
        :date="formatMoveInMonth(subscription.moveInMonth)"
        icon="home"
        :is-last="true"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import TimelineItem from '~/components/subscription/TimelineItem.vue'
import type { Subscription } from '~/types/subscription'

const props = defineProps<{ subscription: Subscription }>()

// 일반 "청약 접수" 행은 순위/특별공급 일정이 하나라도 있으면 숨긴다(중복 방지).
// 청약홈 API상 APT만 특공·1·2순위 일정을 채우고, 오피스텔·무순위·임의공급 등은
// receptionStartDate/receptionEndDate(일반 접수 기간)만 채워진다.
const hasRankSchedule = computed(() =>
  Boolean(
    props.subscription.specialStartDate ||
    props.subscription.rank1AreaStartDate ||
    props.subscription.rank2AreaStartDate,
  ),
)

// 시작일~종료일. 종료일이 없으면(무순위 상시 접수 등) 시작일만.
const receptionDate = computed(() => {
  const start = props.subscription.receptionStartDate
  const end = props.subscription.receptionEndDate
  if (!start) return null
  return end ? `${start} ~ ${end}` : start
})

function formatMoveInMonth(month: string): string {
  if (month.length === 6) {
    return `${month.substring(0, 4)}년 ${parseInt(month.substring(4, 6))}월`
  }
  return month
}
</script>
