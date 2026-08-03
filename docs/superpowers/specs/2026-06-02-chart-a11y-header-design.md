# 차트 접근성 + 헤더 통일 설계 (Frontend Audit ⑤ 일부)

- **작성일:** 2026-06-02
- **출처:** audit ⑤ — 차트/막대 접근성, 헤더 3종 불일치
- **분할:** 1 PR, 2 커밋 (① RentRatioBar a11y · ② faq 헤더 통일)
- **검증:** 단위 테스트 + build + lint.

## 현황 (확인)

- `components/realEstate/RentRatioBar.vue`: `v-if="total > 0"`로 total=0이면 미렌더(OK). 한쪽 pct가 0%일 때(전부 전세/월세) 폭 0 div에 "전세 0%"/"월세 0%" 라벨이 들어가 깨짐. 막대에 `role`/`aria-label` 없음.
- `components/realEstate/PriceTrendChart.vue`: 이미 SSR 스켈레톤(animate-pulse) 보유 → **변경 없음**(audit 기재 stale, 구현 중 재확인만).
- `pages/faq.vue`: raw `<h1 class="text-2xl md:text-3xl font-bold mb-2">자주 묻는 질문</h1>` + 별도 `<p class="text-slate-500 text-sm mb-5">desc</p>`. `components/common/StaticPageHeader.vue`(h1 동일 클래스 + lead + updatedAt 배지)와 구조 동일.

## 비범위

- PageHero(text-display-1) vs StaticPageHeader(text-2xl md:text-3xl) h1 타이포 통일 — 다수 페이지 시각 변경, 후속(시각 검증 필요).
- StaticPageHeader 📅 이모지 → material-symbols — audit ⑥.

---

## ① RentRatioBar 접근성

`components/realEstate/RentRatioBar.vue`:
- 막대 컨테이너(`<div class="flex h-6 ...">`)에 `role="img"` + `:aria-label` 추가. aria-label은 비율+건수 요약: `전세 {jeonsePct}%, 월세 {100-jeonsePct}% (전세 {jeonseCount}건, 월세 {wolseCount}건)`.
- 0% 세그먼트 라벨 깨짐 방지: 각 세그먼트의 텍스트를 해당 pct가 0보다 클 때만 렌더(`<span v-if="jeonsePct > 0">전세 {{ jeonsePct }}%</span>`, 월세 동일). 세그먼트 div 자체는 width 0%라 시각적으로 사라지므로 라벨만 가드해도 충분. (또는 pct===0이면 세그먼트 div 미렌더 — 라벨 가드로 동일 효과.)
- `total > 0` 가드는 유지(0건이면 전체 미렌더).
- 시각: pct>0인 세그먼트는 기존과 동일 출력. 0% 세그먼트의 라벨 텍스트만 사라짐(이미 폭 0이라 안 보이던 것 정리).

**테스트:** `role="img"` 존재, aria-label에 비율·건수 포함, jeonsePct=0(전부 월세)일 때 "전세 0%" 텍스트 미렌더 + "월세 100%" 렌더, total=0이면 미렌더.

---

## ② faq 헤더 통일

`pages/faq.vue`: raw `<h1>` + `<p>` desc를 `<StaticPageHeader>`로 교체.
```vue
<StaticPageHeader
  title="자주 묻는 질문"
  lead="일상킷에서 제공하는 부동산 실거래가와 생활시설 정보에 대해 자주 묻는 질문을 모았습니다."
/>
```
import 추가. 간격 미세 정규화(StaticPageHeader: wrapper `mb-5 md:mb-6`, h1 마진 없음, lead `mt-2 text-sm md:text-base`) — 기존 faq(h1 `mb-2`, p `text-sm mb-5`)와 미세 차이이나 다른 정적 페이지와 일관. h1 텍스트/타이포(text-2xl md:text-3xl font-bold)는 동일.

**테스트:** `faq.test.ts`(있으면) h1 "자주 묻는 질문" 단언 통과. 없으면 StaticPageHeader 렌더 + h1 텍스트 단언 추가.

---

## 커밋 분할
1. `fix(frontend): RentRatioBar role/aria-label + 0% 라벨 처리`
2. `refactor(frontend): faq 헤더를 StaticPageHeader로 통일`
