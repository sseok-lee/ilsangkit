# 시설 카테고리 상시 가이드 생성 — 설계 스펙

> 2026-07-05. `/guide`(상시 how-to)를 빈 시설 카테고리로 채우는 콘텐츠 생성 기능.
> `/article`(시의성 뉴스)와 분리된 별개 스트림. 오늘의 이슈 설계의 자매 작업.

## Goal

빈 **시설 10개 카테고리**에 상시(evergreen) how-to/guide 콘텐츠 ≈**24개 초안**을 OpenAI로 생성 → **어드민 검토 → 발행**한다.

## Scope

**IN (이번 배치)**
- 빈 시설 카테고리 10개 × 2~3개 큐레이션 주제 = **24개 초안**
- 초안(`published:false`) → `/admin` 검토 → 발행 흐름
- evergreen how-to/guide 생성기(신규), 어드민 가이드 관리, `publishedAt` 보정
- 생성 글 안의 `## 자주 묻는 질문`(FAQ)·`## 단계별 방법`(HowTo) 섹션 → 기존 프론트 JSON-LD 점등

**OUT (후속/별개)**
- 부동산 4종(villa-sale/rent, offitel-sale/rent) — 다음 배치
- 이미 있는 5개 시설 카테고리(trash, clothes, hospital, pharmacy, market) 심화
- cron 자동화
- `generateGuide.ts`의 news 경로 하드제거(D3 별도 정리) — 이번엔 **건드리지 않음**(테스트 재수출 의존, 회귀 위험). 신규 생성기를 별 모듈로 추가.
- 푸터 정적 `/faq`(`pages/faq.vue`, 사이트 전체 안내 FAQ) — **무관, 건드리지 않음**. 본 스펙의 `## 자주 묻는 질문`은 개별 가이드 글 본문 안의 마크다운 섹션(전혀 다른 대상).

## 확정 결정 (사용자)

- **커버리지**: 빈 시설 카테고리당 2~3개(24). 시설 먼저, 부동산 보류.
- **발행**: 초안 생성 → `/admin` 검토 → 발행(어드민 게이트).
- **주제**: 아래 큐레이션 목록 승인본.
- **콘텐츠 형태**: how-to/guide 혼합. `## 자주 묻는 질문`(FAQ)은 유지(SEO FAQ JSON-LD), howto는 `## 단계별 방법`(HowTo JSON-LD)까지. 푸터 `/faq`와는 무관.

## 현재 상태 (사전 조사 근거)

- `generateGuide.ts`는 아직 **news 생성기**(`articleType:'news'`, `published:true` 자동발행). how-to 로직 없음.
- `articleGenerationCore.ts`는 news형(요약→본문→참고자료, "기자" 페르소나, NAVER 트렌드). 유틸(`fetchNaverSearch`/`researchByKeyword`/`formatResearchContext`/`getDbStats`/`generateThumbnail`/`generateSectionBody`)은 재사용 가능.
- 프론트 `/guide/[slug].vue`는 **HowTo/FAQ JSON-LD 배관이 이미 존재**(아래 정확 규격). articleType `howto`→HowTo+FAQ, `guide`→FAQ.
- Guide 모델: `category`, `articleType`(default `news`), `published`(bool, default true), `slug`, `thumbnailUrl` 有. `publishedAt` **無**.
- 남은 11개 가이드는 전부 `howto`/`guide`/`listicle`(뉴스 아님) — 라이브 검증된 포맷 선례.

## 아키텍처

### 1. 데이터 모델 (additive, 무마이그레이션)

- `Guide.publishedAt DateTime?` **추가**(nullable). 첫 발행 시 기록. 기존 11개는 null → 직렬화에서 `createdAt` 폴백.
- `published` bool 재사용: `false`=초안, `true`=발행.
- `prisma db push`만(스키마 additive).

### 2. 큐레이션 주제 (단일 소스)

`backend/src/data/facilityGuideTopics.ts`:
```ts
export interface GuideTopicSeed { category: GuideCategory; topic: string; articleType: 'howto' | 'guide'; }
export const FACILITY_GUIDE_TOPICS: GuideTopicSeed[] = [ ... 24 entries ... ];
```
스크립트 시작 시 각 `category`를 `GUIDE_CATEGORIES`/`CATEGORY_LABELS`에 대조해 **fail-fast**(존재하지 않는 키면 즉시 에러).

**24개 목록:**

| # | category | topic | type |
|---|---|---|---|
| 1 | toilet | 급할 때 근처 공중화장실 빨리 찾는 법 | howto |
| 2 | toilet | 개방화장실과 공공화장실 차이 및 이용 팁 | guide |
| 3 | wifi | 무료 공공와이파이 찾고 연결하는 3단계 | howto |
| 4 | wifi | 공공와이파이 안전하게 사용하는 법 | guide |
| 5 | parking | 공영주차장 무료·할인 요금 받는 법 | howto |
| 6 | parking | 거주자 우선주차 신청 방법과 절차 | howto |
| 7 | parking | 근처 저렴한 공영주차장 찾는 법 | guide |
| 8 | aed | 주변 AED(자동심장충격기) 위치 찾고 사용하는 법 | howto |
| 9 | aed | 심정지 응급상황 4단계 대처와 AED 사용법 | howto |
| 10 | library | 공공도서관 회원가입과 도서 대출 방법 | howto |
| 11 | library | 도서관 좌석·스터디룸 예약하는 법 | howto |
| 12 | library | 상호대차와 희망도서 신청 이용법 | guide |
| 13 | park | 가까운 공원과 산책로 찾는 법 | guide |
| 14 | park | 반려견과 함께 갈 수 있는 공원 이용 가이드 | guide |
| 15 | school | 우리 동네 학군과 학교 정보 찾는 법 | guide |
| 16 | school | 초등학교 배정과 전학 절차 안내 | howto |
| 17 | childcare | 어린이집 입소 신청과 대기 방법 | howto |
| 18 | childcare | 국공립 어린이집 찾고 신청하는 법 | howto |
| 19 | childcare | 어린이집 정보공시로 우리 동네 시설 비교하기 | guide |
| 20 | ev-charger | 가까운 전기차 충전소 찾고 이용하는 법 | howto |
| 21 | ev-charger | 전기차 완속·급속 충전 요금과 결제 방법 | guide |
| 22 | ev-charger | 아파트 전기차 충전기 설치 신청 방법 | howto |
| 23 | sports | 공공체육시설 온라인 예약하는 법 | howto |
| 24 | sports | 저렴한 생활체육 프로그램 신청 방법 | guide |

### 3. evergreen 생성기 (신규 모듈)

`backend/src/services/guideDraftGeneration.ts` — `articleGenerationCore` 유틸 재사용, how-to/guide 형태의 meta+섹션 생성.

`generateGuideDraft(openai, { category, topic, articleType }): Promise<GuideDraftResult>`
- **트렌드 발굴 안 함**: `topic`을 그대로 keyword로 사용(`discoverTrendingKeyword` 호출 X).
- **선택적 리서치**: `researchByKeyword(topic)`로 가벼운 그라운딩(절차성 콘텐츠 환각 방지). 실패해도 계속.
- **유틸리티 다리**: `getDbStats(category)`를 본문·CTA에 엮어 사이트 시설 데이터로 연결.
- **페르소나**: "기자" 아님 → "생활정보 전문 에디터/실용 가이드 작성자". 날짜 마커 금지(`stripDateMarkers` 유지).
- **섹션 템플릿(정확 헤딩 필수)**:
  - `howto`: 개요 → `## 단계별 방법`(번호 단계) → 팁·주의사항 → `## 자주 묻는 질문`(FAQ) → 사이트 연결 CTA
  - `guide`: 개요 → 핵심 섹션 2~4개 → `## 자주 묻는 질문` → 사이트 연결 CTA
- 반환 `{ title, summary, content, keywords }`.

**정확 포맷 (프론트 파싱 규격 — [slug].vue:298-335 근거, 어기면 JSON-LD 미점등):**
- FAQ 헤딩: 정확히 `## 자주 묻는 질문`. 항목: `**Q. {질문}**`(한 줄) ⏎ `A. {답변}`. 다음 항목은 `**Q.`로 시작. 3~5개.
  ```
  ## 자주 묻는 질문

  **Q. 질문 내용?**
  A. 답변 내용.

  **Q. 다음 질문?**
  A. 다음 답변.
  ```
- HowTo 헤딩: 정확히 `## 단계별 방법`. 단계: `1. **{단계명}**` ⏎ `{설명}`. 3~8개.
  ```
  ## 단계별 방법

  1. **단계 제목**
  단계 설명 문장.

  2. **다음 단계**
  다음 설명.
  ```

**검증기** `validateGuideDraftStructure(content, articleType)`:
- `howto`: `## 단계별 방법` 존재 + 프론트 정규식으로 ≥3 스텝 파싱, `## 자주 묻는 질문` 존재 + ≥3 Q/A 파싱.
- `guide`: `## 자주 묻는 질문` 존재 + ≥3 Q/A 파싱, 본문 섹션 ≥2.
- 최소 본문 길이(예: 1200자). 실패 시 생성 재시도(최대 N) 후 에러.

**썸네일**: `generateThumbnail`(PNG→cwebp), 인코딩 실패 시 **throw**(PNG-as-webp 금지). 초안 생성 시점 생성.

**저장**: `published:false`, `articleType` = 주제별, slug = `${category}-${articleType}-${cuid}` 형태이되 **Guide+Article 교차 유니크** 확인(`/guide/[slug]` 동적 301 폴백 충돌 방지, `generateArticle.ts` 패턴 재사용).

### 4. 배치 러너

`backend/src/scripts/generateGuideDrafts.ts` — `FACILITY_GUIDE_TOPICS` 순회, 각 초안 생성.
- 플래그: `--dry-run`, `--category <c>`, `--limit <n>`, `--only-missing`(같은 (category, topic) 이미 존재 시 skip).
- **멱등**: 이미 존재하는 (category, topic) 조합은 skip(제목/키 기준). continue-on-failure + 말미 요약(성공/실패/스킵 카운트).
- 레이트리밋(API 30초 타임아웃, 순차).
- npm: `generate:guide:drafts`.

### 5. 어드민 가이드 관리 (`/admin` 확장)

**백엔드** `backend/src/services/adminGuideService.ts` (Article 어드민 패턴 그대로):
- `listAdminGuides(filter)` — 전 상태(초안+발행) 반환.
- `getAdminGuide(id)`.
- `updateAdminGuide(id, { title?, summary?, keywords?, content? })`.
- `publishGuide(id)` — `published:true` + `publishedAt` 첫 발행만 기록.
- `unpublishGuide(id)` — `published:false`.
- `rejectGuide(id)` — 초안 삭제(썸네일 파일 path-traversal-safe 삭제, `adminArticleService` 재사용).

**라우트** `backend/src/routes/admin.ts`에 추가(`requireAdmin` + `requireSameOrigin`):
- `GET /api/admin/guides`, `GET /api/admin/guides/:id`, `PATCH /api/admin/guides/:id`, `POST /api/admin/guides/:id/publish`, `POST /api/admin/guides/:id/unpublish`, `DELETE /api/admin/guides/:id`.
- (초안 생성 트리거 spawn은 이번 범위 아님 — 배치는 CLI로 실행. 후속에 추가 가능.)

**프론트**:
- `frontend/composables/useAdminGuides.ts` (`credentials:'include'`, `useAdminArticles` 패턴).
- `frontend/pages/admin/index.vue`에 **탭 토글(오늘의 이슈 | 생활 가이드)** 추가. 가이드 탭은 초안/발행 목록·본문 읽기·발행/반려/수정.
- `frontend/components/admin/AdminGuideCard.vue`(+ 기존 `AdminArticleEditor` 재사용 또는 병행 `AdminGuideEditor`).

### 6. SEO/JSON-LD

- 프론트 배관 이미 존재(검증 완료, [slug].vue:298-335). 생성기가 정확 헤딩/포맷 방출 시 자동 점등: `howto`→HowTo+FAQ, `guide`→FAQ.
- `[slug].vue`: `datePublished`/`article:published_time`를 `publishedAt ?? createdAt`로 보정.
- 자기 canonical, 제목/요약 카테고리별 고유(중복콘텐츠 방지, [[project_naver_duplicate_content_recovery]]).

## Testing

**백엔드**
- `validateGuideDraftStructure`: 헤딩 누락/오포맷 거부, 정상 통과.
- 초안 생성(OpenAI mock): 결과 content가 **프론트 정규식([slug].vue의 FAQ/HowTo 정규식 그대로)으로 파싱**돼 ≥3 항목 추출됨(라운드트립).
- 교차 slug 유니크(Guide+Article).
- `publishGuide`: `publishedAt` 첫 발행만 세팅, 재발행 시 불변.
- `rejectGuide`: path-traversal-safe 삭제.
- 직렬화 `publishedAt ?? createdAt` 폴백.

**프론트**
- `useAdminGuides` 동작.
- 어드민 가이드 UI(목록/발행/반려) + 탭 전환.
- 가이드 상세 JSON-LD: `howto`/`guide` 픽스처로 HowTo/FAQ 스키마 생성 라운드트립.

## Phases (각 → develop PR, CI green, 사용자 머지)

- **Phase 1 (백엔드)**: 스키마 `publishedAt` + 직렬화 폴백; `facilityGuideTopics.ts`; `guideDraftGeneration.ts`; `generateGuideDrafts.ts`; `adminGuideService` + 라우트; 테스트.
- **Phase 2 (프론트)**: `useAdminGuides`; `/admin` 가이드 탭 + 컴포넌트; `[slug].vue` `publishedAt` 반영; 테스트.
- **Phase 3 (운영)**: 배치 실행(내가) → `/admin` 검토 → 발행 → main 승격 + Cafe24 배포 + 라이브 검증(JSON-LD/canonical/노출).

## Global Constraints

- Node 20; ESM 로컬 import `.js` 확장자; 모든 변경 PR 경유(main 직접 금지); TDD.
- 라우트: `asyncHandler` + `validate`(Zod) + 에러 클래스; 어드민 라우트 `requireAdmin` + `requireSameOrigin`.
- 썸네일 인코딩 실패 시 **throw**(PNG-as-webp 금지).
- **정확 헤딩** `## 단계별 방법` / `## 자주 묻는 질문`; FAQ 항목 `**Q. …**`⏎`A. …`; 단계 `1. **…**`⏎`…`.
- 초안은 `published:false`; slug는 Guide+Article 교차 유니크.
- 공개 API는 `published:true`만 노출(기존 유지).
