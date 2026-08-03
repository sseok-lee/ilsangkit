# 시설 상세 SEO 중복 해소 설계 (childcare · pharmacy · park)

- 작성일: 2026-07-15
- 브랜치: `feat/facility-detail-seo-dedup` (base: `develop`)
- 관련 진단: GSC MCP 라이브 진단 2026-07-15 (메모리 `project_gsc_index_decline_diagnosis_2026_07`)

## 1. 배경 · 문제

GSC 라이브 진단 결과, 색인/노출 감소의 **병리 부분**은 `childcare · pharmacy · park` 세 카테고리의 **중복 콘텐츠 강등**이다.

- 실측: 같은 카테고리 두 상세 페이지의 SSR 본문이 **83~86% 동일**(단어 5-shingle Jaccard 0.486, difflib 86%).
- 스모킹건: 서로 다른 childcare 3개(061·145·165)가 전부 **다른 카테고리 `/trash/6693`** 를 구글 canonical로 병합당함(크로스 카테고리 near-dup).
- URL 검사 표본 genuine deindex: childcare `Duplicate, Google chose different canonical`, pharmacy·park 동일 패턴.
- 같은 병이 네이버에도 발생(색인+47%인데 노출-84%, SA가 색인의 74%를 중복으로 정량화). → **구글·네이버 공통 처방**.

근본 원인은 **데이터 부족이 아니라 제시(presentation)**: 세 카테고리 모두 고엔트로피 구별 데이터를 이미 `detailFields`로 반환하지만, SEO에 노출되는 **제목/설명/FAQ**에는 거의 안 실리고, 공용 템플릿(정적 FAQ·tips·always-on 라벨·헤딩)이 본문을 지배한다.

## 2. 목표 · 성공지표

- **목표:** 같은 카테고리 두 페이지의 SSR 본문 유사도를 ~86% → **60% 미만**(word-5-shingle Jaccard < ~0.30)으로 낮춘다.
- **측정:** 배포 후 라이브 페어 diff 재측정(진단에 쓴 스크립트: 두 동일-카테고리 URL fetch → visible text 추출 → Jaccard/difflib).
- **불변식:** 사이트맵·URL 구조 불변. 나머지 12개 시설 카테고리 렌더 불변. wifi 집계+noindex 전략 불변. FAQ 섹션 자체는 유지(동적 FAQ·tips 존치)하되 **정적 FAQ는 상세에서 제거**(§4 레버 4, 결정 A).

### 2-1. 라이브 측정 근거 (2026-07-15, 프로덕션 페어 diff)

동일 카테고리 2페이지의 `article` 가시 텍스트 5-shingle Jaccard / 본문 자수:

| 카테고리 | 현행 | **A: 정적 FAQ만 제거(채택)** | B: FAQ+팁 전체 제거 |
|---|---|---|---|
| childcare | 0.317 / 2,541자 | **0.203 / 2,016자** | 0.181 / 1,626자 |
| park | 0.424 / 1,937자 | **0.317 / 1,577자** | 0.296 / 1,239자 |
| pharmacy | 0.363 / 2,639자 | **0.252 / 2,121자** | 0.206 / 1,737자 |

- FAQ+팁은 본문의 **약 35%**이며 거의 전부 페이지 간 동일 텍스트 → 최대 단일 레버.
- A안만으로 childcare·pharmacy는 목표(<0.30) 달성. **park만 0.317로 초과** → 레버 1·2로 마저 하강 필요.
- 경쟁 레퍼런스 `local.114-service.co.kr`(동일 운영사·동일 모델) 대응 카테고리 실측: park 791자/0.560, childcenter 691자/0.559, **상세 FAQ 0개**. A안 적용 후 우리는 본문 2배·유사도 절반 우위. (단 저쪽의 실제 색인 성과는 미검증 — 레퍼런스 가정)

## 3. 범위

- 대상: `childcare`, `pharmacy`, `park` (3 카테고리).
- 레이어: **프론트엔드 제시 중심**. 백엔드 변경 불필요 — 필요한 모든 필드가 이미 각 카테고리 `detailFields`에 존재함(확인 완료).
- 비대상: 사이트맵 슬림화(감사 결과 정크 0%), 타 카테고리, URL/canonical 구조(자기참조 정상).

## 4. 설계 — 4개 레버

### 레버 1: 제목 disambiguator (결정 확정: 적용)

`frontend/composables/useFacilityMeta.ts:69`
```ts
const ADDRESS_DISAMBIGUATE_CATEGORIES = new Set<FacilityCategory>(['parking', 'aed', 'clothes'])
```
→ `'childcare', 'pharmacy', 'park'` 추가. `getTitleDisambiguator()`가 동/도로명 꼬리표를 name에 부착 → 같은 시·구 내 동명 시설 제목 충돌 해소(`행복어린이집(혜화동) …`). 검증된 기존 패턴 재사용. 제목 길이 예산: 한글 ~30자, 꼬리표는 동 단위(짧음)로 유지.

### 레버 2: 설명(description) 고엔트로피 팩트 주입

`useFacilityMeta.ts` `buildFacilityDescription` (:156-285)의 카테고리 case에 팩트 추가 + 누락 가드 수정. **길이 예산: 한글 ~150자 이내, 고엔트로피 2~4개만 우선순위로**(키워드 스터핑 금지, 자연문 유지).

- **childcare** (:248-254): 현재 `crtypename` + `정원 N명`(+ `현원 M명`은 truthy 가드로 자주 누락).
  - 추가: **충원율**(`crchcnt/crcapat` → `현원 M명(충원율 X%)`), 현원 0 표기 가드 수정(`!= null` 기반), 선택적으로 `통학차량 운영` 또는 `연령별 반 수`.
- **pharmacy** (:203-207): 현재 **월요일 시간 1개만**(`dutyTime1s/1c`).
  - 추가: **주말·공휴일 운영 여부/시간**(`dutyTime6/7/8` 토·일·공휴일), `noTrmtSun`/`noTrmtHoli`(일·공휴일 휴무), 선택적으로 `약사 수`(`pharmacistCnt`).
- **park** (:227-233): 현재 `parkType`·`area`·`managingOrg`(뒤 둘 저엔트로피).
  - 추가: **보유시설 요약**(`exerciseFacilities`/`playFacilities`/`convenienceFacilities` 앞부분 — 제목 인텐트 `운동시설·편의시설`과 정확히 일치하는 최고 엔트로피 필드), 선택적으로 `designatedDate`.

### 레버 3: SSR 상단 고유화 + pharmacy 게이트 수정

공유 컴포넌트 `DetailFacilityStatus.vue`·`DetailBasicInfo.vue`. **변경은 대상 3카테고리 분기 내로 한정**, 타 카테고리 코드 경로 불변.

- **핵심 팩트 라인(신규, 항상 SSR):** 상세 상단에 레코드별 최고 엔트로피 숫자를 노출.
  - childcare: 정원/현원/충원율/설립유형
  - pharmacy: 오늘 영업상태·주중/주말 시간 요약
  - park: 면적·보유시설 요약
- **pharmacy 시설현황 게이트 버그 수정:** `DetailFacilityStatus.vue:595-599` `hasFacilityStatus`가 `pharmacistCnt > 0`일 때만 true → **대부분 약국은 시설현황 섹션이 아예 렌더 안 됨**. 주간 운영시간·리셉션 등 데이터가 있으면 렌더되도록 게이트 완화.
- **always-on 빈 라벨은 제거하지 않는다:** 기존 정책(`project_facility_detail_section_reorder`: "빈 행도 '정보 없음' 표시" — 사용자 요청)을 존중. 빈 라벨 삭제 대신 **정적 FAQ 제거(레버 4) + 고유 팩트 추가(레버 1·2·핵심 팩트 라인)**로 달성한다.

### 레버 4: 상세에서 정적 FAQ 제거 (결정 확정: A안 — 2026-07-15 사용자 결정)

현재 세 카테고리 모두 **동적 FAQ 생성기 2개뿐** → 5개 중 3개가 전 페이지 동일 정적(`categoryFAQ.ts`). 병합 캡: `dynamicFAQ.ts:315-321`(동적 최대 3 + **정적으로 5까지 채움** ← 이 정적 보충을 상세에서 제거).

**결정: 정적 FAQ는 상세 페이지에서 제거한다. 동적 FAQ와 tips 섹션은 유지한다.**

근거(전부 라이브 실증):

1. **효과가 가장 크다** — FAQ+팁이 본문의 35%이고 거의 100% 공유 텍스트. 정적 FAQ 제거만으로 childcare 0.317→0.203, pharmacy 0.363→0.252로 목표 달성(§2-1).
2. **정적 FAQ는 이미 제자리에 있다** — 동일 문장(`어린이집 입소 신청은 복지로...`)이 `/faq`, `/childcare`(카테고리 페이지), `/childcare/[id]` 상세 **3곳 모두**에 실린 것을 라이브 확인. 카테고리 단위 지식을 상세 2만 페이지에 복제하는 것은 순수 내부 중복. 카테고리 페이지(`pages/[category]/index.vue:557`)가 이미 같은 소스로 FAQPage JSON-LD까지 발행 중 → **제거해도 해당 지식의 색인 커버리지 손실 없음**.
3. **FAQPage 스키마의 SEO 이득은 0** — 구글이 2023.08(상업사이트 제한)·2023.09(폐기)로 FAQ 리치결과를 종료. 코드베이스도 이미 인지(`tests/composables/useStructuredData.test.ts:29` 주석이 정확히 그 사유로 스키마 제거를 기록). 상세 FAQ에 남은 가치는 본문 깊이·사용자 가치뿐이며 SERP 보너스는 없다.
4. **경쟁 레퍼런스는 상세 FAQ가 0개**(§2-1) — thin 회피 5요소 레시피(`reference_competitor_seo_sites`)에도 FAQ는 없다.

유지 대상:

- **동적 FAQ 유지 + 생성기 확장**(레코드 값 삽입, 자연문). 단 동적 FAQ는 문장 골격이 보일러플레이트이고 시설현황에 이미 있는 사실의 재진술이므로 **유사도 감소 효율이 낮음 → 확장은 park 우선**(A안 후 유일한 목표 미달 카테고리).
  - park: 보유시설(운동/놀이/편의) Q, 지정일/면적 Q (`:216-229` 확장 — 5개 시설 텍스트 필드 미활용)
  - childcare: 정원·현원·충원율 Q, 통학차량 Q (`:262-275` 확장)
  - pharmacy: 주말·공휴일 운영 Q, 점심시간 Q (`:195-211` 확장)
- **tips 유지**: `dynamicTips.ts` 캡(`:120` slice(0,3)) 및 생성기 확장(park는 이미 시설 필드 활용하나 캡에 눌림).
- **`categoryFAQ.ts`는 삭제하지 않는다** — `/faq`, `/[category]/index.vue`, `/trash/[id]`, `/subway/*`가 계속 사용. 상세(`pages/[category]/[id].vue`)의 정적 보충 경로만 끊는다.

**⚠️ 뒤집는 과거 결정:** `tests/pages/detail.test.ts:278-291` 가드 테스트("화면 FAQ만으론 SEO 가치가 없으므로 `setFAQSchema`로 FAQPage JSON-LD 발행" — 이전 spec §3.4·§6 결정4)가 존재. 정적 FAQ 제거 시 상세 FAQPage JSON-LD는 **동적 FAQ만으로 발행**되도록 축소하고 해당 가드 테스트를 이 결정에 맞게 갱신한다(스키마 발행 자체는 유지, 소스만 동적 한정). 3번 근거상 스키마의 실효 이득은 0이므로 발행 유지는 비용 0의 보수적 선택.

## 5. 카테고리별 미활용 데이터 (전부 detailFields에 존재 = 백엔드 변경 0)

| | 제목 인텐트 | 현재 설명 팩트 | 주입할 미활용 고엔트로피 |
|---|---|---|---|
| childcare | 정원·현원 | 유형, 정원(현원 누락) | 충원율, 연령별 반(`classCnt*`/`childCnt*`), CCTV(`cctvinstlcnt`), 통학차량(`crcargbname`) |
| pharmacy | 영업시간·야간 | 월요일 시간만 | 주말·공휴일 시간(`dutyTime6/7/8`), 일·공휴일 휴무(`noTrmt*`), 점심(`lunch*`), 약사수(`pharmacistCnt`) |
| park | 운동시설·편의시설 | 유형·면적·관리기관 | 보유시설 5종(`exerciseFacilities` 등), 지정일(`designatedDate`) |

## 6. 가드레일

- 공유 컴포넌트(`DetailFacilityStatus.vue`·`DetailBasicInfo.vue`·`dynamicFAQ.ts`·`dynamicTips.ts`) 변경은 **대상 3카테고리 분기 내로 국한**. 나머지 12개 카테고리 출력 바이트 불변을 스냅샷 테스트로 증명.
- canonical/robots 로직 불변(`pages/[category]/[id].vue:428-460`). noindex 게이트 불변.
- 광고 슬롯·order 불변(AdBanner 배치 정책 유지).
- 설명/제목 길이 예산 준수(과다 주입·키워드 스터핑 금지).

## 7. 테스트 전략 (TDD — 테스트 먼저)

- **메타 단위테스트**(`useFacilityMeta`): 대상 3카테고리 제목에 disambiguator 포함, 설명에 신규 팩트 포함, 현원 0/충원율 가드, 길이 예산.
- **FAQ/tips 생성기 테스트**: 동일 입력 2개 레코드에서 답변이 값에 따라 달라짐(변동성) + 자연문.
- **정적 FAQ 제거 테스트**: 대상 3카테고리 상세 SSR에 `CATEGORY_FAQ` 문자열이 **부재**(동적만 렌더). 반대로 `/[category]/index.vue`·`/faq`에는 **여전히 존재**(회귀 방지 — 지식 커버리지 보존 증명).
- **FAQPage JSON-LD 가드 갱신**: `tests/pages/detail.test.ts:278-291` — 발행은 유지하되 `mainEntity`가 동적 FAQ만 포함함을 검증하도록 수정.
- **SSR 렌더 테스트**: 대상 카테고리 상세에 핵심 팩트 라인 렌더, pharmacy 시설현황 게이트 완화 렌더.
- **회귀 스냅샷**: 나머지 12개 카테고리 상세 렌더 불변.
- 커밋 전 백엔드+프론트 `vitest run` 그린(프로젝트 원칙), Node 20.

## 8. 롤아웃 (결정 확정: 3 스택 PR)

- **PR 1** (base `develop`): 공유 기반(레버 1 disambiguator 3카테고리, **상세 정적 FAQ 보충 경로 차단**, FAQPage 가드 테스트 갱신) + **childcare** 데이터/렌더/FAQ + 테스트. childcare 먼저 배포·효과 검증 가능.
- **PR 2** (base PR1 브랜치): **pharmacy** 데이터/설명/게이트 수정/FAQ + 테스트.
- **PR 3** (base PR2 브랜치): **park** 데이터/설명/FAQ + 테스트.
- 각 PR: 커밋 카테고리별 분리, CI(lint+test+build) 그린 후 develop 머지. main 승격은 별도(배포 후 라이브 유사도 재측정 체크리스트).

## 9. 리스크 · 논스코프

- 리스크: 공유 컴포넌트 회귀 → 스냅샷 테스트로 방어. 설명 과다 길이 → 예산·우선순위로 방어.
- **리스크: 정적 FAQ 제거로 본문 축소 → "비어보임" 회귀**(`project_facility_detail_redesign` 이력). A안은 본문 1,577~2,121자를 유지(경쟁사의 2배)하고 레버 1·2·핵심 팩트 라인이 고유 텍스트를 되채우므로 타격 제한적. **PR별 배포 후 시각 확인 필수**.
- 리스크: park는 A안만으로 0.317(목표 미달) → 레버 1·2 필수. PR 3에서 배포 후 재측정으로 <0.30 확인, 미달 시 동적 FAQ 생성기 추가 확장.
- 논스코프: 사이트맵 변경, 타 카테고리, 백엔드 스키마, wifi/aed 집계 전략, 광고 정책, `categoryFAQ.ts` 삭제(타 페이지가 계속 사용).

## 10. 확정된 결정

1. 범위 = childcare + pharmacy + park (3개).
2. 전략 = **정적 FAQ 제거(A안) + 고유팩트 주입**. ~~데이터화~~ — 2026-07-15 라이브 측정으로 개정: 정적 FAQ는 이미 `/faq`·카테고리 페이지에 존재하는 지식의 상세 2만 페이지 복제이고, FAQPage 리치결과는 2023 폐기라 SEO 이득 0이므로 **유지할 근거가 없음**. 동적 FAQ·tips 섹션은 존치. (§4 레버 4)
3. 제목 disambiguator = 3카테고리 적용.
4. PR = 3 스택.
5. 성공지표 = 유사도 < 60%(Jaccard < ~0.30), 배포 후 재측정.
6. FAQPage JSON-LD = 상세에서 발행 유지하되 소스는 동적 FAQ 한정. 이전 spec §3.4·§6 결정4의 가드 테스트 갱신.
