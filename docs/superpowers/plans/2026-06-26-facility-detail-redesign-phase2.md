# 시설 상세페이지 재설계 — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Phase 1의 스펙 그리드 구조를 나머지 **12개 facility-detail 카테고리**(wifi, park, parking, library, sports, market, school, childcare, aed, pharmacy, hospital, ev-charger)로 확장. `trash`는 WasteSchedule(상세페이지 없음) → 제외.

**Architecture:** `DetailSpecGrid`/`SpecGroup`에 **2개 렌더 분기(`tags`, `weekly`) + `SpecRow.href`** 추가(기존 `TagBadges`·`WeekdayHoursTable` 재사용, 신규 컴포넌트 없음). 각 카테고리 `buildSpecGroups` 빌더를 `facilitySpecGroups.ts`에 추가하고 `REDESIGNED_CATEGORIES` 게이트에 등록. aed CTA·ev-charger 라이브 컴포넌트는 redesigned 경로로 재배치.

**Tech Stack:** Nuxt 3 + Vue 3 `<script setup>` (TS), Vitest(happy-dom) + @vue/test-utils, Tailwind.

**Base branch:** `feat/facility-detail-redesign-phase2` (stacked on Phase 1 `feat/facility-detail-redesign` @ 5de964bf). PR base = `feat/facility-detail-redesign` (Phase 1 develop 머지 후 develop으로 retarget).

## Global Constraints

- **Node 20** (`source ~/.nvm/nvm.sh && nvm use 20`) before any vitest/npm/build. `package-lock.json` 건드리지 말 것.
- **단일 h1** — 페이지 literal h1 없음(MobileDetailHeader). 빌더는 데이터만 반환(h-tag 금지). `weekly`는 WeekdayHoursTable의 자체 `<h3>` 제목을 쓰므로 그룹 `<p>` 헤딩 중복 억제.
- **광고 4개(redesigned)** — `pages/[category]/[id].vue:143`의 `v-if="!isRedesigned"` 광고가 off → redesigned는 4개(117/126/215/282). 카테고리 추가로 개수 변하면 안 됨.
- **`정보 없음` 계약** — `kind:'value'` 빈 값=`정보 없음`, `kind:'flag'` 빈 값=행 숨김, 빈 그룹(tags/weekly/table/kv 전부 빈) 통째 숨김.
- **degrade-to-empty / 슬롭 금지** — 빈 섹션 생성 금지. redesigned는 `staticFill:false`(동적 FAQ만).
- **non-redesigned 무손상** — 미이관 카테고리·기존 경로 변경 금지.
- **SSR-first + hydration 안전** — `weekly`의 오늘 강조는 `onMounted` 후에만(SSR/첫 페인트는 강조 없음, 동일 HTML). `import.meta.client` 가드.
- **vitest auto-import 함정** — 직접 mount SFC는 `ref/computed/onMounted` 등 `vue` 명시 import.
- **Tailwind order** `order-1`~`order-12`만.
- 커밋 전 해당 테스트 `npx vitest run` 통과.

---

## File Structure

| 파일 | 역할 | 변경 |
|------|------|------|
| `frontend/utils/facilitySpecGroups.ts` | 타입 확장(`SpecRow.href`/`SpecTag`/`SpecWeeklyRow`/`render` 확장/`tags`/`tagVariant`/`weekly`) + 공유 헬퍼 + 12 빌더 + REGISTRY | 수정 |
| `frontend/components/facility/detail/DetailSpecGrid.vue` | `tags`/`weekly` 분기 + kv `href` 앵커 + `todayDow` + heading 억제 + visibleGroups | 수정 |
| `frontend/pages/[category]/[id].vue` | `REDESIGNED_CATEGORIES`에 12개 추가(배치별) + aed CTA·EvChargerDetail 재배치 | 수정 |
| `frontend/components/facility/detail/TagBadges.vue`, `WeekdayHoursTable.vue` | 재사용(무변경) | — |
| `frontend/tests/...` | 빌더 단위 + DetailSpecGrid + 페이지 가드 | 신규 |

---

## Task 1: 렌더러 확장 — `DetailSpecGrid` + `SpecGroup`에 tags/weekly/href

**Files:**
- Modify: `frontend/utils/facilitySpecGroups.ts` (types)
- Modify: `frontend/components/facility/detail/DetailSpecGrid.vue`
- Test: `frontend/tests/components/facility/detail/DetailSpecGrid.test.ts` (확장)

**Interfaces — Produces:**
```ts
export interface SpecRow { label: string; value: string|number|null|undefined; unit?: string; kind?: 'value'|'flag'; href?: string }
export interface SpecTag { label: string; suffix?: string; colorClass?: string }
export interface SpecWeeklyRow { day: string; time: string; lunch?: string; closed?: boolean; allDay?: boolean; todayIdx?: number }
export interface SpecGroup {
  heading?: string
  render: 'kv'|'table'|'tags'|'weekly'
  rows?: SpecRow[]
  table?: SpecTable
  tags?: SpecTag[]
  tagVariant?: 'teal'|'gray'|'sky'|'custom'
  weekly?: { timeHeader: string; showLunch?: boolean; rows: SpecWeeklyRow[]; notes?: string[] }
}
```
`todayIdx`: 월=1..토=6, 일=0, 공휴일=-1. 렌더러가 `new Date().getDay()`와 비교(빌더는 순수, Date 미사용).

- [ ] **Step 1: Write failing tests** (append to DetailSpecGrid.test.ts)

```ts
import WeekdayHoursTable from '~/components/facility/detail/WeekdayHoursTable.vue'
// (mount globalConfig already stubs SectionBlock)

it('tags group: 칩으로 렌더', () => {
  const html = mountGrid([{ render: 'tags', tagVariant: 'gray', tags: [{ label: '채소' }, { label: '과일' }] }]).html()
  expect(html).toContain('채소'); expect(html).toContain('과일')
})
it('weekly group: WeekdayHoursTable에 위임', () => {
  const w = mountGrid([{ heading: '진료시간', render: 'weekly', weekly: { timeHeader: '진료시간', rows: [{ day: '월', time: '09:00 ~ 18:00', todayIdx: 1 }] } }])
  expect(w.findComponent(WeekdayHoursTable).exists()).toBe(true)
})
it('href row: 앵커로 렌더', () => {
  const w = mountGrid([{ render: 'kv', rows: [{ label: '홈페이지', value: 'example.com', href: 'http://example.com', kind: 'value' }] }])
  const a = w.find('a'); expect(a.exists()).toBe(true); expect(a.attributes('href')).toBe('http://example.com')
})
it('visibleGroups: 빈 tags/weekly 그룹 숨김', () => {
  expect(mountGrid([{ render: 'tags', tags: [] }]).text().trim()).toBe('')
  expect(mountGrid([{ render: 'weekly', weekly: { timeHeader: 't', rows: [{ day: '월', time: '휴진', closed: true, todayIdx: 1 }] } }]).text().trim()).toBe('')
})
```

- [ ] **Step 2: Run → FAIL** `cd frontend && npx vitest run tests/components/facility/detail/DetailSpecGrid.test.ts` (tags/weekly/href 미지원)

- [ ] **Step 3: Edit `facilitySpecGroups.ts` types** — replace the `SpecRow`/`SpecGroup` interfaces with the extended versions above; add `SpecTag`/`SpecWeeklyRow`.

- [ ] **Step 4: Edit `DetailSpecGrid.vue`**
  1. Script: `import { ref, computed, onMounted } from 'vue'`; `import TagBadges from './TagBadges.vue'`; `import WeekdayHoursTable from './WeekdayHoursTable.vue'`. Add `const todayDow = ref(-99); onMounted(() => { todayDow.value = new Date().getDay() })`.
  2. Heading 억제(weekly는 자체 제목): `<p v-if="group.heading && group.render !== 'weekly'" ...>`.
  3. table 분기 뒤, kv `v-else` 앞에 추가:
```vue
<TagBadges v-else-if="group.render === 'tags'" :items="group.tags ?? []" :variant="group.tagVariant ?? 'gray'" />
<div v-else-if="group.render === 'weekly' && group.weekly">
  <WeekdayHoursTable
    :title="group.heading ?? ''"
    :time-header="group.weekly.timeHeader"
    :show-lunch="group.weekly.showLunch"
    :rows="group.weekly.rows.map(r => ({ ...r, isToday: r.todayIdx === todayDow }))"
  />
  <p v-for="(n, ni) in group.weekly.notes ?? []" :key="ni" class="mt-1 text-xs text-gray-500">{{ n }}</p>
</div>
```
  4. kv 값 span: `href` 있으면 앵커:
```vue
<a v-if="hasValue(row.value) && row.href" :href="row.href" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline">{{ row.value }}</a>
<span v-else-if="hasValue(row.value)" class="text-sm font-medium" :class="row.kind === 'flag' ? 'text-emerald-600' : 'text-slate-900'">{{ row.value }}<span v-if="row.unit" class="text-xs font-normal text-gray-600">{{ row.unit }}</span></span>
<span v-else class="text-sm text-slate-400">정보 없음</span>
```
  5. `visibleGroups` computed:
```ts
const visibleGroups = computed(() => props.groups.filter((g) => {
  if (g.render === 'table') return (g.table?.rows.length ?? 0) > 0
  if (g.render === 'tags') return (g.tags?.length ?? 0) > 0
  if (g.render === 'weekly') return g.weekly?.rows.some(r => !r.closed) ?? false
  return (g.rows ?? []).some((r) => r.kind !== 'flag' || hasValue(r.value))
}))
```

- [ ] **Step 5: Run → PASS** (전체 DetailSpecGrid.test.ts + 기존 facilitySpecGroups.test.ts 회귀)
- [ ] **Step 6: Commit** `feat(facility-detail): extend DetailSpecGrid with tags/weekly/href`

---

## Task 2: 공유 헬퍼 + 단순 빌더 5종 (wifi, park, parking, library, sports) + 게이트

**Files:** Modify `facilitySpecGroups.ts` (헬퍼+5빌더+REGISTRY), `pages/[category]/[id].vue` (게이트), Test `tests/utils/facilitySpecGroups.test.ts`.

- [ ] **Step 1: 헬퍼 추가** (기존 `formatYm` 아래)
```ts
const localeNum = (v: unknown): string | null => { const n = num(v); return n == null ? null : n.toLocaleString() }
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : [])
const splitList = (v: unknown): string[] => { const s = str(v); return s ? s.split('+').map(x => x.trim()).filter(Boolean) : [] }
const joinList = (v: unknown): string | null => { const i = splitList(v); return i.length ? i.join(', ') : null }
const yesNo = (v: unknown): string | null => (typeof v === 'boolean' ? (v ? '있음' : '없음') : null)
const httpUrl = (v: unknown): string | null => { const s = str(v); if (!s) return null; return /^https?:\/\//.test(s) ? s : `http://${s}` }
const trimDashes = (v: unknown): string | null => { const s = str(v); return s ? (s.replace(/^[\s-]+|[\s-]+$/g, '').trim() || null) : null }
const fmtHm = (v: unknown): string | null => { const s = str(v)?.replace(/\D/g, ''); if (!s || s.length < 3) return null; const p = s.padStart(4, '0'); return `${p.slice(0,2)}:${p.slice(2,4)}` }
const formatYmd = (v: unknown): string | null => { const s = str(v)?.replace(/\D/g, ''); if (!s || s.length !== 8) return str(v); return `${s.slice(0,4)}년 ${Number(s.slice(4,6))}월 ${Number(s.slice(6,8))}일` }
const formatArea = (v: unknown): string | null => { const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null); if (n == null) return null; return `${n.toLocaleString()}㎡ (약 ${Math.round(n*0.3025).toLocaleString()}평)` }
const formatOpeningCycle = (v: unknown): string | null => { const s = str(v); if (!s) return null; if (s === '매일') return '매일'; if (/\d/.test(s)) return `매월 ${splitList(s).join(', ')}`; return s }
const feePair = (fee: unknown, time: unknown): string | null => { const f = num(fee); const t = num(time); if (f == null && t == null) return null; if (f != null && t != null) return `${f.toLocaleString()}원 / ${t}분`; return f != null ? `${f.toLocaleString()}원` : `${t}분` }
const formatLibraryHours = (open: unknown, close: unknown): string | null => { const s = str(open); const e = str(close); if (!s) return null; if (s === '00:00' && (!e || e === '00:00')) return '휴관'; return `${s} ~ ${e || s}` }
```

- [ ] **Step 2: 빌더 5종** — `wifiGroups`, `parkGroups`, `parkingGroups`, `libraryGroups`, `sportsGroups` (synthesis "Group A" 코드 그대로). REGISTRY에 등록.
- [ ] **Step 3: 단위 테스트** — 각 빌더: full fixture → 기대 그룹/헤딩/render, `{}` → no throw·강제 정보없음 없음. (synthesis 가드 체크리스트)
- [ ] **Step 4: 게이트** — `pages/[category]/[id].vue:332` `REDESIGNED_CATEGORIES`에 `'wifi','park','parking','library','sports'` 추가.
- [ ] **Step 5: 페이지 가드 테스트** — 각 카테고리: 단일 h1, 4 AdBanner, spec-grid 존재, DetailBasicInfo/Status 부재. (parametrize 가능)
- [ ] **Step 6: lint+build+해당 vitest → PASS. Commit** `feat(facility-detail): migrate wifi/park/parking/library/sports to spec grid`

---

## Task 3: tags 빌더 3종 (market, school, childcare) + 게이트

**Files:** `facilitySpecGroups.ts` (3빌더+상수), `pages/[category]/[id].vue` (게이트), tests.

- [ ] **Step 1: 빌더** — `marketGroups`, `schoolGroups`, `childcareGroups` + 상수 `CHILD_CLASS_DEFS`/`CHILD_STAFF_DEFS`/`CHILD_CAREER_DEFS` (synthesis "Group B" 코드 그대로). REGISTRY 등록.
- [ ] **Step 2: 단위 테스트** — tags 그룹 ≥1 항목일 때만, enrollments/departments 배열 처리, 가용률·합계 계산, `{}` no throw.
- [ ] **Step 3: 게이트** — `'market','school','childcare'` 추가.
- [ ] **Step 4: 페이지 가드** (단일 h1·4광고·spec-grid).
- [ ] **Step 5: lint+build+vitest → PASS. Commit** `feat(facility-detail): migrate market/school/childcare (tags) to spec grid`

---

## Task 4: weekly 빌더 (aed, pharmacy, hospital) + aed CTA 재배치 + 게이트

**Files:** `facilitySpecGroups.ts` (3빌더+상수), `pages/[category]/[id].vue` (게이트 + aed CTA 재배치), tests.

- [ ] **Step 1: 빌더** — `aedGroups`, `pharmacyGroups`, `hospitalGroups` + 상수 `HOSPITAL_BED_DEFS`/`HOSPITAL_DAYS` (synthesis "Group C" 코드 그대로). REGISTRY 등록.
- [ ] **Step 2: 단위 테스트** — weekly 그룹 ≥1 non-closed day일 때만, fmtHm/요일 매핑·todayIdx, hospital departments tags + bed 합계, `{}` no throw.
- [ ] **Step 3: aed CTA 재배치** — 현재 `DetailBasicInfo.vue`의 `119 신고`/`AED 사용법` CTA가 redesigned에서 게이트오프됨. `pages/[category]/[id].vue`에 `v-if="isRedesigned && category === 'aed'"` 블록으로 동등 CTA를 redesigned 경로(예: 스펙그리드 인접)에 추가. (DetailBasicInfo 원본 마크업 확인 후 1:1 이전)
- [ ] **Step 4: 게이트** — `'aed','pharmacy','hospital'` 추가.
- [ ] **Step 5: 가드** — 단일 h1·4광고·spec-grid + **weekly가 WeekdayHoursTable로 렌더(SSR 오늘강조 없음=hydration 안전)** + **aed CTA가 redesigned에 존재**.
- [ ] **Step 6: lint+build+vitest → PASS. Commit** `feat(facility-detail): migrate aed/pharmacy/hospital (weekly) + relocate AED CTAs`

---

## Task 5: ev-charger — 정적 빌더 + EvChargerDetail 라이브 상속 재배치 + 게이트

**Files:** `facilitySpecGroups.ts` (`evChargerGroups`), `pages/[category]/[id].vue` (게이트 + EvChargerDetail 재배치), tests.

ev-charger는 station 단위 그룹핑 + 실시간 충전상태(`EvChargerDetail.vue`, 30초 폴링)가 핵심. 현재 `EvChargerDetail`은 게이트오프되는 `DetailFacilityStatus.vue` 안에서 렌더됨. **스펙 그리드는 정적 필드만 담당하고, 라이브 컴포넌트는 redesigned 경로의 형제로 재배치.**

- [ ] **Step 1: 정적 빌더** — `evChargerGroups(d)`: 충전기(chgerType·powerType·output·method), 운영(busiNm·busiCall·useTime·parkingFree·limitYn/Detail·note), 위치 상세(floorNum/Type·maker·year). 실시간 stat은 라이브 컴포넌트가 담당하므로 정적 그룹에서 제외(또는 마지막 동기화 표기). REGISTRY 등록.
- [ ] **Step 2: 단위 테스트** — 정적 그룹 렌더, `{}` no throw.
- [ ] **Step 3: EvChargerDetail 재배치** — `pages/[category]/[id].vue`에 `v-if="isRedesigned && category === 'ev-charger'"`로 `<EvChargerDetail .../>`를 redesigned 경로(스펙그리드 인접)에 렌더(현재 DetailFacilityStatus 내부 사용을 참고해 props 동일 전달). 게이트오프된 경로에서 라이브 리스트가 사라지지 않게.
- [ ] **Step 4: 게이트** — `'ev-charger'` 추가.
- [ ] **Step 5: 가드** — 단일 h1·4광고·spec-grid + **EvChargerDetail이 redesigned에 형제로 존재**.
- [ ] **Step 6: lint+build+전체 vitest → PASS. Commit** `feat(facility-detail): migrate ev-charger (static groups + live EvChargerDetail sibling)`

---

## 데이터 검증 (각 배치 머지 전 필수)

`facility.details{}`가 빌더가 읽는 raw 필드를 실제로 전달하는지 확인 — 특히 weekly 시작/종료(`trmtMonStart`/`dutyTime1s`/`monSttTme`…), 배열(`departments`/`enrollments`), **숫자 타입**(`capacity`/`bookCount`/`standCptPsnCnt`/`*Fee`/`*Cnt`). 헬퍼가 `num()`을 쓰므로 numeric-string이면 조용히 `정보 없음`으로 떨어짐 → 그 경우 헬퍼 확장 또는 빌더에서 coerce. (실 데이터 1건씩 `/api/facilities/:cat/:id` 응답으로 확인)

## 최종 검증 + PR

- 전체 `npm run test`(Node 20) green + `npm run build` ✓.
- 라이브 SSR 스모크: 각 카테고리 1건씩(특히 hospital weekly·market tags·ev-charger 라이브) `.nuxt` 클린 후 dev에서 SSR 렌더 확인.
- whole-branch 리뷰(opus).
- PR base = `feat/facility-detail-redesign`(stacked). #487 develop 머지 후 develop으로 retarget.

## 후속 (비범위)
- 12종 이관 완료 후 `DetailFacilityStatus.vue`+`DetailBasicInfo.vue` dead-code 정리.
- 지역 컨텍스트(Phase 1B), area highlights 확장, note/longtext kind 폴리시, childcare 경력 색상.
