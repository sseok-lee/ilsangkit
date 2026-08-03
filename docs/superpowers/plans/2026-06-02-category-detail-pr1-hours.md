# 카테고리 상세 일관성 PR1 — 운영시간 통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** hospital/aed의 요일별 운영시간 표를 공유 프리미티브 `WeekdayHoursTable`로 추출하고, pharmacy도 동일 표(오늘 강조)로 통일한다.

**Architecture:** `WeekdayHoursTable.vue` 프리미티브(요일 행 + "오늘" 강조 + 옵션 점심/종일 스타일)를 만들고, DetailBasicInfo의 hospital·aed 인라인 표를 출력 동일하게 교체. pharmacy는 부모(`[id].vue`)에 `pharmacyWeeklyHours` computed를 추가해 같은 표로 렌더.

**Tech Stack:** Nuxt 3 SSR, Vue 3 `<script setup>`, Vitest + @vue/test-utils + happy-dom.

**참조 spec:** `docs/superpowers/specs/2026-06-02-category-detail-consistency-design.md` (PR1)

**전제:** Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`). 작업 디렉터리 `frontend/`. 브랜치 `feat/category-detail-hours`(컨트롤러 생성). 커밋 스테이징은 **명시 경로만**(절대 `git add -A` 금지 — 무관 untracked 다수).

---

## File Structure

- `components/facility/detail/WeekdayHoursTable.vue` — (신규) 요일별 운영시간 표 프리미티브
- `components/facility/detail/DetailBasicInfo.vue` — (수정) hospital/aed/pharmacy 운영시간 블록을 프리미티브로 교체
- `pages/[category]/[id].vue` — (수정) `pharmacyWeeklyHours` computed 추가 + prop 전달
- `tests/components/facility/detail/WeekdayHoursTable.test.ts` — (신규)
- `tests/components/facility/detail/DetailBasicInfo.test.ts` — (수정) pharmacy 계약 재정의

---

## 현재 구조 (참고)

- DetailBasicInfo는 weekday 데이터를 **props로 받음**:
  - `hospitalWeeklyHours: Array<{ day; time; lunch; closed; isToday }>` (`:654`)
  - `aedWeeklyHours: Array<{ day; time; allDay; closed; isToday }>` (`:657`)
  - `pharmacyOperatingHours: Array<{ day; time }>` (`:659`) — isToday/closed 없음
- aed 표(`:265-291`): 2열(요일/이용시간). time 셀 색: `allDay`→green, `closed`→gray.
- hospital 표(`:344-378`): 3열(요일/진료시간/점심). 아래 noTrmtSun/noTrmtHoli 안내.
- pharmacy(`:607-636`): `pharmacyOperatingHours` 단순 행 + 점심(평일/토)·접수·안내 행.
- 부모 `[id].vue` computed: `hospitalWeeklyHours`(`:780`), `aedWeeklyHours`(`:828`), `pharmacyOperatingHours`(`:735`, dutyTime1s..8c 기반).

---

## Task 1: WeekdayHoursTable 프리미티브 + 단위 테스트

**Files:**
- Create: `frontend/components/facility/detail/WeekdayHoursTable.vue`
- Test: `frontend/tests/components/facility/detail/WeekdayHoursTable.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — `frontend/tests/components/facility/detail/WeekdayHoursTable.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WeekdayHoursTable from '~/components/facility/detail/WeekdayHoursTable.vue'

const rows = [
  { day: '월', time: '09:00 ~ 18:00', isToday: false, closed: false },
  { day: '화', time: '09:00 ~ 18:00', isToday: true, closed: false },
  { day: '일', time: '휴무', isToday: false, closed: true },
]

describe('WeekdayHoursTable', () => {
  it('title과 시간 헤더, 요일 행을 렌더한다', () => {
    const w = mount(WeekdayHoursTable, { props: { title: '요일별 진료시간', timeHeader: '진료시간', rows } })
    expect(w.text()).toContain('요일별 진료시간')
    expect(w.text()).toContain('진료시간')
    expect(w.findAll('tbody tr')).toHaveLength(3)
    expect(w.text()).toContain('09:00 ~ 18:00')
  })

  it('isToday 행에 ★ 및 강조 클래스를 적용한다', () => {
    const w = mount(WeekdayHoursTable, { props: { title: '요일별 진료시간', timeHeader: '진료시간', rows } })
    const todayRow = w.findAll('tbody tr')[1]
    expect(todayRow.text()).toContain('★')
    expect(todayRow.classes()).toContain('bg-primary-50')
  })

  it('closed 행은 회색 스타일', () => {
    const w = mount(WeekdayHoursTable, { props: { title: '요일별 진료시간', timeHeader: '진료시간', rows } })
    const closedCell = w.findAll('tbody tr')[2].findAll('td')[1]
    expect(closedCell.classes()).toContain('text-gray-400')
  })

  it('allDay 행은 green 스타일', () => {
    const w = mount(WeekdayHoursTable, { props: { title: '요일별 이용시간', timeHeader: '이용시간', rows: [{ day: '월', time: '24시간', isToday: false, allDay: true }] } })
    const cell = w.find('tbody tr').findAll('td')[1]
    expect(cell.classes()).toContain('text-green-600')
  })

  it('showLunch=true면 점심 컬럼을 렌더한다', () => {
    const w = mount(WeekdayHoursTable, { props: { title: '요일별 진료시간', timeHeader: '진료시간', showLunch: true, rows: [{ day: '월', time: '09:00 ~ 18:00', isToday: false, lunch: '12:30 ~ 13:30' }] } })
    expect(w.text()).toContain('점심')
    expect(w.text()).toContain('12:30 ~ 13:30')
  })

  it('showLunch 기본 false면 점심 헤더 없음', () => {
    const w = mount(WeekdayHoursTable, { props: { title: '요일별 이용시간', timeHeader: '이용시간', rows } })
    expect(w.find('thead').text()).not.toContain('점심')
  })
})
```

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/components/facility/detail/WeekdayHoursTable.test.ts`
Expected: FAIL — 컴포넌트 없음.

- [ ] **Step 3: 컴포넌트 작성** — `frontend/components/facility/detail/WeekdayHoursTable.vue`

```vue
<template>
  <div>
    <h3 class="text-sm font-bold text-slate-900 mb-3">{{ title }}</h3>
    <table class="w-full text-sm border-collapse">
      <thead>
        <tr class="bg-slate-50">
          <th class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium w-12">요일</th>
          <th class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium">{{ timeHeader }}</th>
          <th v-if="showLunch" class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium">점심</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr
          v-for="row in rows"
          :key="row.day"
          :class="row.isToday ? 'bg-primary-50 font-semibold' : ''"
        >
          <td class="py-1.5 px-2 text-xs font-medium" :class="row.isToday ? 'text-primary-700' : 'text-slate-600'">
            {{ row.day }}{{ row.isToday ? ' ★' : '' }}
          </td>
          <td
            class="py-1.5 px-2 text-xs"
            :class="row.allDay ? 'text-green-600 font-medium' : row.closed ? 'text-gray-400' : 'text-slate-800'"
          >
            {{ row.time }}
          </td>
          <td v-if="showLunch" class="py-1.5 px-2 text-xs text-gray-500">{{ row.lunch }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
export interface WeekdayHoursRow {
  day: string
  time: string
  isToday: boolean
  closed?: boolean
  allDay?: boolean
  lunch?: string
}

withDefaults(defineProps<{
  title: string
  timeHeader: string
  rows: WeekdayHoursRow[]
  showLunch?: boolean
}>(), {
  showLunch: false,
})
</script>
```

- [ ] **Step 4: 통과 확인**
Run: `cd frontend && npx vitest run tests/components/facility/detail/WeekdayHoursTable.test.ts`
Expected: PASS (6).

- [ ] **Step 5: 커밋**
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/facility/detail/WeekdayHoursTable.vue frontend/tests/components/facility/detail/WeekdayHoursTable.test.ts
git commit -m "feat(frontend): WeekdayHoursTable 프리미티브 추출 + 단위 테스트"
```

---

## Task 2: hospital/aed 운영시간을 WeekdayHoursTable로 교체

**Files:**
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue` (aed `:264-291`, hospital `:343-378`)

- [ ] **Step 1: 기존 DetailBasicInfo 테스트가 여전히 통과하는지 기준 확인**
Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailBasicInfo.test.ts`
Expected: 현재 PASS (교체 전 baseline).

- [ ] **Step 2: aed 인라인 표 교체**
`DetailBasicInfo.vue`에서 import 추가(스크립트 상단):
```ts
import WeekdayHoursTable from '~/components/facility/detail/WeekdayHoursTable.vue'
```
aed 요일표 블록(`:265-291`, `<template v-if="aedWeeklyHours.length > 0"> ... </template>` 중 `<div>` 내부 `<h3>`+`<table>`)을 아래로 교체(바깥 `<template v-if>`와 구분선 `<div class="h-px ...">`은 유지):
```vue
        <template v-if="aedWeeklyHours.length > 0">
          <div class="h-px bg-slate-100 w-full"></div>
          <WeekdayHoursTable title="요일별 이용시간" time-header="이용시간" :rows="aedWeeklyHours" />
        </template>
```
(`aedWeeklyHours`의 항목은 `{ day, time, allDay, closed, isToday }` — `WeekdayHoursRow`와 호환. allDay→green, closed→gray가 프리미티브에서 동일 처리됨.)

- [ ] **Step 3: hospital 인라인 표 교체**
hospital 요일표 블록(`:344-378`)의 `<div>` 내부 `<h3>`+`<table>`을 `WeekdayHoursTable`로 교체하되, **아래 noTrmtSun/noTrmtHoli 안내 `<p>`는 유지**:
```vue
        <template v-if="hospitalWeeklyHours.length > 0">
          <div class="h-px bg-slate-100 w-full"></div>
          <div>
            <WeekdayHoursTable title="요일별 진료시간" time-header="진료시간" :show-lunch="true" :rows="hospitalWeeklyHours" />
            <p v-if="(details as any)?.noTrmtSun" class="mt-2 text-xs text-gray-500">
              <span class="font-medium">일요일 안내:</span> {{ (details as any).noTrmtSun }}
            </p>
            <p v-if="(details as any)?.noTrmtHoli" class="text-xs text-gray-500">
              <span class="font-medium">공휴일 안내:</span> {{ (details as any).noTrmtHoli }}
            </p>
          </div>
        </template>
```
(`hospitalWeeklyHours` 항목 `{ day, time, lunch, closed, isToday }` — `showLunch=true`로 점심 컬럼 렌더. 출력 동일.)

- [ ] **Step 4: 회귀 테스트**
Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailBasicInfo.test.ts`
Expected: hospital weekly-hours 관련 테스트 PASS 유지(프리미티브 경유여도 표 출력/"오늘" 동일). 실패 시 셀렉터가 인라인 `<table>` 구조를 가정했는지 확인 — 프리미티브도 동일 `<table>/tbody/tr` 구조라 통과해야 함.

- [ ] **Step 5: lint + 커밋**
Run: `cd frontend && npx eslint components/facility/detail/DetailBasicInfo.vue components/facility/detail/WeekdayHoursTable.vue`
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/facility/detail/DetailBasicInfo.vue
git commit -m "refactor(frontend): hospital/aed 운영시간을 WeekdayHoursTable로 교체"
```

---

## Task 3: pharmacy 운영시간을 WeekdayHoursTable로 통일

**Files:**
- Modify: `frontend/pages/[category]/[id].vue` (`pharmacyWeeklyHours` computed 추가 + prop 전달)
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue` (pharmacy 블록 `:607-636` + props 타입)
- Test: `frontend/tests/components/facility/detail/DetailBasicInfo.test.ts` (pharmacy 계약 재정의)

- [ ] **Step 1: 실패 테스트 — pharmacy 계약 재정의**
`tests/components/facility/detail/DetailBasicInfo.test.ts`에서 기존 "pharmacy 단순 행/표 없음"을 단언하는 테스트를 찾아, pharmacy가 `WeekdayHoursTable`(요일별 표)을 렌더하도록 재정의. 먼저 파일을 읽어 기존 pharmacy 테스트와 mount 헬퍼(props 주입 방식)를 확인. pharmacy 표는 새 prop `pharmacyWeeklyHours`로 구동되므로 테스트에서 그 prop을 주입:
```ts
it('pharmacy는 요일별 운영시간 표(WeekdayHoursTable)를 렌더한다', () => {
  const wrapper = mountDetailBasicInfo({  // 기존 헬퍼 사용; pharmacy facility + 아래 prop
    facility: { ...pharmacyFacility },
    pharmacyWeeklyHours: [
      { day: '월', time: '09:00 ~ 18:00', isToday: false, closed: false },
      { day: '일', time: '휴무', isToday: false, closed: true },
    ],
  })
  expect(wrapper.text()).toContain('요일별 운영시간')
  expect(wrapper.findAll('tbody tr').length).toBeGreaterThanOrEqual(2)
})
```
(정확한 헬퍼/픽스처 이름은 기존 테스트 파일에 맞춰 조정. 기존에 "pharmacy에 table 없음"을 단언하던 케이스는 삭제하거나 위 케이스로 대체.)

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailBasicInfo.test.ts`
Expected: 새 pharmacy 테스트 FAIL.

- [ ] **Step 3: 부모에 pharmacyWeeklyHours computed 추가**
`pages/[category]/[id].vue`의 `pharmacyOperatingHours` computed(`:735`) 다음에 추가(hospitalWeeklyHours 패턴 차용):
```ts
// Pharmacy 요일별 운영시간 표 (오늘 강조)
const pharmacyWeeklyHours = computed(() => {
  if (facility.value?.category !== 'pharmacy' || !facility.value?.details) return []
  const d = facility.value.details as import('~/types/facility').PharmacyDetails
  const today = new Date().getDay() // 0=일 ... 6=토
  const DAY_DEFS = [
    { label: '월', s: d.dutyTime1s, e: d.dutyTime1c, todayIdx: 1 },
    { label: '화', s: d.dutyTime2s, e: d.dutyTime2c, todayIdx: 2 },
    { label: '수', s: d.dutyTime3s, e: d.dutyTime3c, todayIdx: 3 },
    { label: '목', s: d.dutyTime4s, e: d.dutyTime4c, todayIdx: 4 },
    { label: '금', s: d.dutyTime5s, e: d.dutyTime5c, todayIdx: 5 },
    { label: '토', s: d.dutyTime6s, e: d.dutyTime6c, todayIdx: 6 },
    { label: '일', s: d.dutyTime7s, e: d.dutyTime7c, todayIdx: 0 },
    { label: '공휴일', s: d.dutyTime8s, e: d.dutyTime8c, todayIdx: -1 },
  ]
  const rows = DAY_DEFS.map(({ label, s, e, todayIdx }) => {
    const time = formatPharmacyTime(s, e)
    return {
      day: label,
      time: time ?? '휴무',
      closed: time === null,
      isToday: todayIdx === today,
    }
  })
  // 모든 요일이 휴무(데이터 전무)면 표를 숨김
  return rows.some(r => !r.closed) ? rows : []
})
```
(`formatPharmacyTime`은 같은 파일에 이미 존재 — `pharmacyOperatingHours`가 사용 중.)

prop 전달 추가 — DetailBasicInfo 호출(`:145` `:pharmacy-operating-hours=...` 근처)에 추가:
```vue
                :pharmacy-weekly-hours="pharmacyWeeklyHours"
```

- [ ] **Step 4: DetailBasicInfo에 prop 추가 + pharmacy 블록 교체**
`DetailBasicInfo.vue` props 정의(`:659` 부근, `pharmacyOperatingHours` 옆)에 추가:
```ts
  pharmacyWeeklyHours: Array<{ day: string; time: string; closed: boolean; isToday: boolean }>
```
pharmacy 블록(`:607-636`)에서 `pharmacyOperatingHours` 단순 행 렌더(`:609-612` 의 `<div v-for ...>`)를 WeekdayHoursTable로 교체하되, **점심(평일/토)·접수·안내 `<p>` 행들은 유지**:
```vue
        <template v-if="pharmacyWeeklyHours.length > 0 || pharmacyOperatingHours.length > 0">
          <div class="h-px bg-slate-100 w-full"></div>
          <div class="flex flex-col gap-3">
            <WeekdayHoursTable
              v-if="pharmacyWeeklyHours.length > 0"
              title="요일별 운영시간"
              time-header="운영시간"
              :rows="pharmacyWeeklyHours"
            />
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">점심(평일)</span>
              <span v-if="details?.lunchWeek" class="text-sm font-medium text-slate-900">{{ details.lunchWeek }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">점심(토)</span>
              <span v-if="details?.lunchSat" class="text-sm font-medium text-slate-900">{{ details.lunchSat }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
          </div>
          <p v-if="details?.recpWeek" class="text-xs text-gray-500">
            <span class="font-medium">접수(평일):</span> {{ details.recpWeek }}
          </p>
          <p v-if="details?.recpSat" class="text-xs text-gray-500">
            <span class="font-medium">접수(토):</span> {{ details.recpSat }}
          </p>
          <p v-if="details?.noTrmtSun" class="text-xs text-gray-500">
            <span class="font-medium">일요일 안내:</span> {{ details.noTrmtSun }}
          </p>
          <p v-if="details?.noTrmtHoli" class="text-xs text-gray-500">
            <span class="font-medium">공휴일 안내:</span> {{ details.noTrmtHoli }}
          </p>
        </template>
```
(주: 기존 `pharmacyOperatingHours` prop은 fallback 조건에만 남겨두거나, `pharmacyWeeklyHours`로 완전 대체. 위 코드는 `pharmacyWeeklyHours`가 있으면 표를, 없으면(데이터 전무) 표 미렌더하되 점심/접수 행은 유지. `pharmacyOperatingHours`를 더 이상 본문에 쓰지 않으면 미사용 prop 경고가 날 수 있으니, 사용처가 없으면 prop 정의와 부모 전달에서 함께 제거 — 단 다른 컴포넌트가 안 쓰는지 확인.)

- [ ] **Step 5: 통과 확인**
Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailBasicInfo.test.ts`
Expected: pharmacy 새 테스트 PASS + 기존 hospital/toilet 등 PASS 유지.

- [ ] **Step 6: lint + 커밋**
Run: `cd frontend && npx eslint pages/\[category\]/\[id\].vue components/facility/detail/DetailBasicInfo.vue`
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/\[category\]/\[id\].vue frontend/components/facility/detail/DetailBasicInfo.vue frontend/tests/components/facility/detail/DetailBasicInfo.test.ts
git commit -m "feat(frontend): pharmacy 운영시간을 WeekdayHoursTable로 통일 + 테스트 재정의"
```

---

## Task 4: 회귀 검증 + 시각 확인 + PR

- [ ] **Step 1: 관련 테스트**
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/facility/detail/`
Expected: PASS.

- [ ] **Step 2: lint**
Run: `cd frontend && npm run lint 2>&1 | tail -5` → 0 errors.

- [ ] **Step 3: 전체 테스트**
Run: `cd frontend && npm run test 2>&1 | tail -8` → 전체 PASS.

- [ ] **Step 4: SSR 빌드**
Run: `cd frontend && npm run build 2>&1 | tail -8` → exit 0.
(주: 떠 있는 dev 서버는 build로 .nuxt가 덮여 깨질 수 있음 → 이후 재시작은 사용자 위임.)

- [ ] **Step 5: 시각/SSR 확인 (dev 떠 있을 때)**
세 카테고리의 요일표가 동일 구조로 렌더되는지 확인:
```bash
for CAT in hospital aed pharmacy; do
  ID=$(curl -s "http://localhost:8000/api/facilities/$CAT/search" -X POST -H 'Content-Type: application/json' -d '{"category":"'$CAT'","page":1,"limit":1}' | python3 -c "import sys,json;d=json.load(sys.stdin);i=d.get('data',{}).get('items',[]);print(i[0]['id'] if i else 'NONE')")
  echo "$CAT id=$ID 요일표:$(curl -s "http://localhost:3000/$CAT/$ID" | grep -oc '요일별')"
done
```
Expected: hospital/aed/pharmacy 모두 "요일별" 표 헤딩 ≥1(데이터 있는 시설 기준). 가능하면 브라우저로 세 페이지 표 시각 동일성 육안 확인.

- [ ] **Step 6: PR**
```bash
git push -u origin feat/category-detail-hours
gh pr create --base develop --title "카테고리 상세 일관성 PR1: 운영시간 WeekdayHoursTable 통일" --body "audit ④ PR1. hospital/aed 요일표를 WeekdayHoursTable 프리미티브로 추출, pharmacy도 동일 표(오늘 강조)로 통일."
```
CI 통과 후 머지.

---

## Self-Review 결과

- **Spec coverage:** P1-1(WeekdayHoursTable)=T1 / P1-2(hospital·aed 교체)=T2 / P1-3(pharmacy 통일)=T3 / P1-4(단일-openTime 카테고리 1줄 유지)=변경 없음(범위 외, 회귀로 확인). 검증=T4.
- **Placeholder scan:** 코드 단계 실제 코드 포함. T3 Step1/Step4의 "기존 헬퍼/픽스처에 맞춰 조정"은 기존 테스트 파일 구조 의존이라 구현자가 파일 읽고 맞추는 정당한 지시(플레이스홀더 아님). curl ID는 런타임 값.
- **Type consistency:** `WeekdayHoursRow{day,time,isToday,closed?,allDay?,lunch?}` = T1 정의. hospitalWeeklyHours(lunch/closed/isToday)·aedWeeklyHours(allDay/closed/isToday)·pharmacyWeeklyHours(closed/isToday) 모두 호환. `WeekdayHoursTable` props(title/timeHeader/rows/showLunch) T2·T3 사용 일관.
- **Out of scope:** library 운영시간 구조, PR2 항목(카드 스타일/정보없음/heroStats).
