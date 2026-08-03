# 오늘의 이슈 — 정책 브리핑 트랙 설계

작성일: 2026-07-07
상태: 설계 확정 (사용자 승인 대기)
관련: [[project_today_issue_article_feature]] — 기존 "오늘의 이슈"(`/article`) 스트림의 확장

---

## 1. 배경 & 문제

"오늘의 이슈"(`/article`)는 이미 프로덕션 라이브다. 현재 유일한 생성 경로는 **뉴스 트랙**:

- `generateArticle.ts` → `articleGenerationCore.ts`
- 흐름: 카테고리 → 네이버 뉴스 제목으로 트렌드 키워드 발굴 → 네이버 뉴스·블로그 검색 → **제목+description 스니펫**을 `[리서치 자료]`로 GPT에 제공 → 섹션별 본문 생성 → 썸네일 → `Article` draft → 어드민 검토·발행

**한계**: GPT에 주어지는 근거가 네이버 검색 결과의 **짧은 스니펫뿐**이다. 원문 본문이 없어 근거가 얕고, 스니펫에 없는 수치·일정을 모델이 지어낼 여지가 남는다. 사이트는 SEO 중복/얇음 이력([[project_naver_duplicate_content_recovery]])이 있어, 근거의 두께와 출처 신뢰도가 품질 방어의 핵심이다.

## 2. 목표

기존 뉴스 트랙을 **유지**한 채, 정부 정책 원문 **본문 전문**을 근거로 삼는 **정책 브리핑 트랙**을 추가한다.

- 실제 정책 항목 1건을 먼저 고르고, 그 **원문 전문**을 근거로 글을 쓴다 (뉴스 트랙과 순서가 반대)
- 부동산·주거·육아 등 **국가 정책이 실제로 움직이는 카테고리에 집중**
- 자동 발행 없음 — 기존 어드민 검토·발행 게이트를 그대로 통과
- 출처 표기로 저작권(공공누리 제1유형) 준수

### 비목표 (YAGNI)

- 임의 언론사 본문 스크래핑 (깨지기 쉽고 저작권 리스크 — 채택 안 함)
- cron 자동화 (별도 후속, 기존 Phase 5와 동일 취급)
- 뉴스 트랙 대체 (추가일 뿐, 대체 아님)
- 전 카테고리 커버 (화장실·와이파이 등 정책 없는 카테고리 제외)
- 제목 후보 N개 생성 후 선택 방식 (프롬프트 문구 강화로 충분 — 후속 여지)

### 경쟁 분석 — ayo.pe.kr/article (2026-07-07 실측)

동일 운영사(CodeCraft) 레퍼런스([[reference_competitor_seo_sites]])의 `/article` 스트림을 Playwright로 실측한 결과, 우리 설계 방향이 전 축에서 우위임을 확인:

- **발행**: `/article/detail/{순차 ID}`, 하루 1건 자동 발행. 주제는 정책·부동산·복지·경제 뉴스 해설 (우리 "오늘의 이슈"와 동일 콘셉트)
- **약점(우리의 차별점)**: 본문 ~1,150~1,400자로 얇음 / **출처 표기 전무**(뉴스 사실 인용하나 무출처) / 무검수 자동 배포로 slop 노출(깨진 토큰 "지역 st", 타 기사 문장 누출, 낡은 인물 언급) / 중복 meta description / JSON-LD `@type:WebPage`(Article 아님) / `datePublished==dateModified`
- **차별화 결론**: 우리는 (1) korea.kr 본문 전문 근거, (2) 명시적 출처 표기, (3) 2,000자+ 구조 검증, (4) 어드민 사람 검토, (5) per-article Article JSON-LD·자기 canonical로 품질 우위. 단, ayo의 **정기 발행 cadence**는 참고 가치 있음(P5 cron + 1회 1~2건 기본값과 연결)

## 3. 데이터 소스

**문화체육관광부 정책브리핑 정책뉴스 API** (data.go.kr 15095335) — 사용자 활용신청 완료.

- 페이지: `https://www.data.go.kr/data/15095335/openapi.do`
- 엔드포인트: `http://apis.data.go.kr/1371000/policyNewsService/policyNewsList`
- 인증: data.go.kr `serviceKey` (기존 `OPENAPI_SERVICE_KEY` 재사용 가능)
- 라이선스: **공공누리 제1유형**(출처표시 시 상업적 이용·수정 가능)
- 트래픽: 개발계정 1,000회/일

### 필드 (P1에서 라이브 엔드포인트로 최종 확정)

요청:

| 파라미터 | 용도 |
|---|---|
| `serviceKey` | 인증 |
| `startDate` / `endDate` | 기간 필터 (`YYYYMMDD`) |
| `pageNo` / `numOfRows` | 페이징 |

응답:

| 필드 | 용도 |
|---|---|
| `DataContents` | **본문 전문** (`ContentsType` `H`=HTML / `T`=text) — 핵심 근거 |
| `NewsItemId` | **dedup 키** |
| `Title`, `SubTitle1~3` | 제목/부제 |
| `MinisterCode` | 부처 필터 (국토부·복지부 값은 라이브 확인) |
| `GroupingCode` | 분류 |
| `ApproveDate`, `ModifyDate` | 발행/수정일 |
| `ThumbnailUrl`, `OriginalUrl` | 썸네일/원문 링크 |

> ⚠️ 폐기 확인: 보도자료 API(15095295)는 현재 404(폐기). 15개 기관 보도자료(15105015)는 문체부 산하 문화기관용이라 부적합. **정책뉴스(15095335) 1종만 사용.**

## 4. 아키텍처 (기존 코드 최대 재사용)

정책 트랙은 `generateOneArticle`의 **앞단**(수집·선정·컨텍스트 구성)만 교체하고, `generateArticle(openai, category, keyword, researchContext, dbStats)` 코어와 slug/CTA/내부링크/썸네일/저장은 그대로 재사용한다.

### 4.1 신규 파일

**`backend/src/services/policyBriefingClient.ts`**
- `fetchRecentPolicyNews({ startDate, endDate, pageNo, numOfRows }): Promise<PolicyNewsItem[]>`
- `PolicyNewsItem`: `{ newsItemId, title, subTitle, ministerCode, dataContents(전문·HTML제거), approveDate, originalUrl, thumbnailUrl }`
- `DataContents`가 HTML(`ContentsType=H`)이면 태그 제거해 plain text화 (기존 `stripHtmlTags` 패턴 재사용)
- 키 누락 시 뉴스 트랙과 동일하게 warn 후 빈 배열 (fail-soft)
- `AbortSignal.timeout` 적용, 에러 시 빈 배열

### 4.2 코어 확장 (`articleGenerationCore.ts`)

- `formatPolicyContext(item: PolicyNewsItem): string` — `[정책 원문]` 블록 생성. 뉴스 트랙의 `formatResearchContext`와 동일 계약(“이 자료에서 확인되는 사실만 사용, 없는 수치·일정 임의 생성 금지”)이되 스니펫이 아닌 **본문 전문**을 넣는다.
- `POLICY_FOCUS_CATEGORIES: GuideCategory[]` = `['subscription','apt-sale','apt-rent','villa-sale','villa-rent','offitel-sale','offitel-rent','childcare']`
  - 단, 현재 `GUIDE_CATEGORIES`에는 villa/offitel이 없음(부동산 실거래 카테고리와 별개). **P1 결정**: 우선 `GUIDE_CATEGORIES`에 존재하는 `subscription`/`apt-sale`/`apt-rent`/`childcare`로 시작하고, villa/offitel 확장은 후속. (부처 범위 국토부·복지부와 정합)
- `selectPolicyCandidate(openai, items, focusCategories, avoidExternalIds): Promise<{ item, category, keyword } | null>` — 후보 목록을 GPT에 주고 (a) 시민 관심도 높은 1건 선정 (b) 포커스 카테고리 중 최적 배정 (c) 글 주제 키워드 도출. **적합 후보 없으면 `null`**(억지 생성 방지).

### 4.3 오케스트레이터 확장 (`generateArticle.ts`)

- `generateOnePolicyArticle(options): Promise<GeneratedArticle | null>`:
  1. `startDate`/`endDate` = 최근 7~14일, `fetchRecentPolicyNews`로 후보 수집 (numOfRows ~50)
  2. 부처 프리필터(`MinisterCode` ∈ 국토부·복지부) — 코드 확정 전엔 스킵 가능, GPT 배정이 실질 게이트
  3. 이미 쓴 정책 제외: `Article.sourceExternalId` 조회로 `avoidExternalIds` 구성
  4. `selectPolicyCandidate` → `null`이면 무생성 종료
  5. `researchContext = formatPolicyContext(item)`
  6. **기존 `generateArticle(...)` 코어 재사용** → slug/CTA/내부링크/썸네일도 기존 로직 재사용
  7. 저장: `articleType='policy-brief'`, `sourceExternalId=item.newsItemId`, `sources=[{ title: item.title, url: item.originalUrl }]`
- CLI: `npm run generate:article -- --track policy [--count N]` (기본 track=news로 기존 동작 불변)
- `parseArticleCliOptions`에 `track: 'news'|'policy'` 추가 (기본 `'news'`)

### 4.4 스키마 (`prisma/schema.prisma`)

`Article` 모델에 추가:

```prisma
sourceExternalId String? @db.VarChar(100)  // 정책뉴스 NewsItemId (dedup)
@@index([sourceExternalId])
```

- `articleType`: 기존 default `"news-brief"` 유지. 정책 트랙은 `"policy-brief"` 명시 저장.
- `db:push`로 반영 (기존 컨벤션). Node 20에서 실행.

### 4.5 어드민 (`routes/admin.ts` + `adminArticleService.ts`)

- 기존 `POST /api/admin/articles/generate` 에 `track: 'news'|'policy'`(기본 news) 파라미터 추가 → spawn argv에 `--track` 전달. 단일-플라이트 락·injection-safe spawn 방식 불변.
- `assertGenerationReady`: 정책 track이면 `OPENAPI_SERVICE_KEY` 존재도 프리플라이트(없으면 503 `POLICY_API_NOT_CONFIGURED`).
- 프론트 어드민: 생성 트리거에 track 선택(뉴스/정책) + 목록 카드에 `policy-brief` 뱃지("정책"). 소규모 UI.

### 4.6 출처·저작권

- 본문 말미 "참고 자료" 섹션에 **출처: 대한민국 정책브리핑(korea.kr) / {부처명} + 원문 링크** 필수 삽입 (공공누리 제1유형 출처표시 의무).
- 텍스트만 근거로 사용. **원문에 박힌 사진/이미지는 재게시 안 함**(제3자 저작권 회피). 썸네일은 기존 `gpt-image-1` 생성분 사용(korea.kr 이미지 미사용).

### 4.7 생성 품질 — 제목 프롬프트 강화 (공유 코어, 양 트랙 적용)

현재 `generateArticleMeta`(`articleGenerationCore.ts:369`)의 제목 지시는 `"20~40자, 핵심이 드러나는 제목"` 한 줄로 밋밋하다. 관심을 끌되 **낚시가 아닌 "구체적이라서 눈이 가는"** 제목이 되도록 규칙을 추가한다. 브랜드 성격(`실용적·신뢰감·깔끔함`, 안티=AI 슬롭·과장)에 맞춰 클릭베이트는 금지.

프롬프트에 `<title-rules>` 블록 추가:

```
<title-rules>
- 25~40자. 독자가 "내 얘기다" 싶게 구체적 대상·변화·이득을 담을 것
- 무엇이 → 누구에게 → 어떻게 달라지는지가 드러나게
- 숫자·핵심 변화를 앞에 (예: "3가지", "6개월 내", "이렇게 바뀐다")
- 금지: 과장어("충격·대박·필독"), 낚시 물음표 남발, 허위 긴급성, 근거 없는 단정
- 카테고리/지역 키워드를 자연스럽게 포함(SEO)
</title-rules>
```

그리고 출력 스키마 예시 줄을 `"title": "25~40자, 구체적이고 눈이 가는 제목 (title-rules 준수)"` 로 교체.

- **적용 범위**: `generateArticleMeta`는 뉴스·정책 트랙이 공유하므로 **양쪽 제목이 함께 개선**된다(track별 분기 안 함 — 공통 강화가 단순하고 이득 큼).
- **회귀 주의**: 제목 길이 상한이 20→40에서 25~40으로 바뀌므로, 기존 제목 길이 검증/`VarChar(200)`엔 영향 없음. 뉴스 트랙 기존 테스트가 제목 문자열을 하드코딩 검증하지 않는지 P1에서 확인.

## 5. 데이터 흐름

```
정책뉴스 API (국토부·복지부, 최근 7~14일, 본문 전문)
  → 부처 프리필터(선택) + Article.sourceExternalId 로 dedup
  → GPT: 후보 1건 선정 + 포커스 카테고리 배정 + 주제 키워드 (없으면 null → 무생성)
  → formatPolicyContext(원문 전문) = researchContext
  → [기존] generateArticle 코어: meta → 섹션 본문 → 구조 검증
  → [기존] CTA·내부링크·썸네일
  → Article draft 저장 (articleType='policy-brief', sourceExternalId, sources=korea.kr 링크)
  → [기존] 어드민 검토 → 발행
```

## 6. 예외 처리

| 상황 | 처리 |
|---|---|
| 신규 정책 없음 / 적합 후보 없음(`null`) | 로그 남기고 무생성 종료. 어드민엔 "후보 없음" |
| API 키 미설정 | `assertGenerationReady` 503 fail-closed (기존 패턴) |
| 정책뉴스 API 오류/타임아웃 | 빈 배열 → 무생성 종료 (fail-soft) |
| 썸네일 실패 | 기존과 동일하게 **throw**(글 등록 중단). PNG-as-webp 금지([[project_guide_thumbnail_png_as_webp]]) |
| 동시 생성 | 기존 단일-플라이트 락([[project_ssr_noindex_pool_exhaustion]] 예방) |

## 7. 테스트 (Vitest, 기존 패턴)

- `policyBriefingClient`: fetch mock으로 파싱·HTML제거·타임아웃·키누락 fail-soft
- `formatPolicyContext`: 본문 전문 포함 + "임의 생성 금지" 계약 문구 포함
- `selectPolicyCandidate`: 적합 후보 없을 때 `null` 반환, dedup(avoidExternalIds) 반영
- `generateOnePolicyArticle`: `articleType='policy-brief'`·`sourceExternalId` 저장, 출처 표기 삽입 확인
- CLI: `--track policy` 파싱, 기본 `news` 불변
- 회귀: 기존 뉴스 트랙 테스트 전부 green 유지

## 8. 단계 (각 PR, [[feedback_pr_workflow]] 준수)

- **P0 (사용자·완료)**: 정책뉴스 API 활용신청 ✅. P1 착수 시 라이브 엔드포인트로 필드명 1회 실측.
- **P1 백엔드**: `policyBriefingClient` + 코어 확장(`formatPolicyContext`/`selectPolicyCandidate`) + `generateOnePolicyArticle` + `--track` CLI + `sourceExternalId` 스키마 + **제목 프롬프트 강화(§4.7, 공유 코어)** + 테스트.
- **P2 어드민**: `/api/admin/articles/generate` track 파라미터 + 프론트 track 선택·"정책" 뱃지.
- **P3 공개·SEO·배포**: 출처 표기 노출 확인 + main 승격·라이브 검증([[feedback_verify_ground_truth]]).

## 9. 미해결/확정 필요

- `MinisterCode`의 국토부·복지부 실제 값 (P1 라이브 확인)
- 보도자료 API 응답 필드명 — 해당 없음(정책뉴스 1종만 사용)
- villa/offitel 포커스 카테고리 확장 여부 — 후속(현재 `GUIDE_CATEGORIES` 미포함)
- 정책 트랙 1회 생성 건수 기본값 (제안: 1~2건)
