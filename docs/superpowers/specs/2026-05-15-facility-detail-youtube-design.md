# 시설 상세 페이지 — 관련 유튜브 영상 섹션 설계

- **작성일**: 2026-05-15
- **범위**: 시설 상세 페이지 (`/[category]/[id]`) 15개 카테고리
- **목표**: 시설명·지역 기반 YouTube 검색 결과를 상세 페이지 하단에 노출하여 (1) 사용자 가치 보강, (2) thin content 페이지 색인률 개선, (3) VideoObject schema로 구글 동영상 캐러셀 노출 기회 확보

## 1. 적용 범위 & UX

### 대상 페이지
- `/[category]/[id]` 시설 상세 페이지 전체 (toilet, trash, wifi, clothes, parking, aed, library, hospital, pharmacy, park, school, market, childcare, ev-charger, sports)
- 부동산/청약/지하철 등 다른 상세 페이지는 이번 범위에서 제외 (추후 이터레이션)

### 배치
- 본문 하단, 시설 상세 카드 다음 / 주변 시설·리뷰 영역 위
- 모바일·데스크톱 동일 위치

### 표시
- 썸네일 + 제목 + 채널명 카드 6개
- 모바일 2열 / 데스크톱 3열 그리드
- easy-parking.xyz와 동일한 정적 카드 패턴 (iframe 임베드 X)

### 클릭 동작
- 카드 클릭 시 **사이트 내 모달**에서 YouTube iframe 임베드 재생
- 사용자가 사이트 안에서 영상을 보고 본문으로 돌아오게 → 체류 시간 보호, 이탈 신호 차단
- 모바일 풀스크린 / 데스크톱 중앙 다이얼로그
- ESC, 배경 클릭, 닫기 버튼으로 닫힘. 닫으면 iframe DOM 제거 (자동재생 정지)

### 외부 링크 처리
- 모달 안의 보조 "YouTube에서 보기" 링크: `rel="nofollow noopener noreferrer"`, `target="_blank"`
- 임베드는 `youtube-nocookie.com` 도메인 사용 (개인정보·쿠키 최소화)

### 결과 없음
- API 응답에서 사용 가능 영상이 2개 미만이면 섹션 자체를 렌더링하지 않음 (DOM에서 제거)
- 캐시에 `itemCount=0`으로 저장되면 30일 동안 재호출 없이 섹션 숨김 유지

## 2. 검색 쿼리 & 결과 필터링

### 쿼리 빌더
`backend/src/services/youtubeService.ts`에 카테고리별 쿼리 패턴 한 함수로 모음:

```ts
function buildYoutubeQuery(facility: Facility, category: FacilityCategory): string
```

| 카테고리 | 쿼리 패턴 | 예시 |
|---|---|---|
| parking | `{name} {district} 주차장` | `종로주차장 종로구 주차장` |
| toilet | `{name} 공중화장실 {district}` | `광화문역 공중화장실 종로구` |
| park | `{name} {city}` | `남산공원 서울` |
| library | `{name} {district}` | `종로도서관 종로구` |
| hospital | `{name} {district}` | `서울대병원 종로구` |
| pharmacy | `{name} {district} 약국` | `종로약국 종로구 약국` |
| school | `{name} {district}` | `경복초등학교 종로구` |
| market | `{name} {district}` | `광장시장 종로구` |
| ev-charger | `{stationName} 전기차 충전소` | `이마트 종로점 전기차 충전소` |
| sports | `{name} {district}` | `종로체육관 종로구` |
| childcare | `{name} {district} 어린이집` | `해님 어린이집 종로구` |
| aed | `{name} AED {district}` | (결과 품질 낮을 가능성 — 캐시에 0건 누적 시 향후 제외 검토) |
| wifi / clothes / trash | 동일 패턴 적용 | (영상이 거의 없을 것으로 예상, 빈 캐시 누적되며 자연스럽게 섹션 숨겨짐) |

지역 정보는 facility의 `city`/`district` 필드를 그대로 사용. 표준화는 별도 단계 없이 DB 값 사용.

### API 호출 파라미터
- `part=snippet`
- `type=video` (플레이리스트/채널 제외)
- `maxResults=10` (필터링 후 6개 선별 여유)
- `relevanceLanguage=ko`
- `regionCode=KR`
- `safeSearch=moderate`
- `videoEmbeddable=true` (모달 임베드 필수 조건)
- `order=relevance` (기본값)

### 결과 필터링
- 제목/채널명에 광고 키워드 포함 시 제외 — 블랙리스트 (`광고`, `협찬`, `AD`, `[광고]` 등). `youtubeService.ts`의 상수 배열로 관리
- 채널 차단 리스트 (저품질/스팸 채널 발견 시 누적할 수 있도록 상수 배열)
- 60초 미만 Shorts는 일단 포함 (필터링 토글은 추후 별도 이슈)
- 최종 6개 선별 후 캐시 저장

## 3. 백엔드 캐싱 & API 한도 관리

### 환경 변수
- `YOUTUBE_API_KEY` — Google Cloud Console에서 발급, YouTube Data API v3 활성화
- `.env`에 저장 (gitignore 적용 중), `.env.example`에는 빈 placeholder만 추가
- 운영 환경에서는 Cafe24 서버 `.env`에 별도 설정
- GCP 콘솔에서 키 제한 권장: API 제한(YouTube Data API v3만), 애플리케이션 제한(서버 IP 화이트리스트)

### 캐시 테이블 (Prisma)

```prisma
model FacilityYoutubeCache {
  id          Int      @id @default(autoincrement())
  category    String
  facilityId  String
  query       String
  videos      Json
  itemCount   Int
  fetchedAt   DateTime @default(now())
  expiresAt   DateTime

  @@unique([category, facilityId])
  @@index([expiresAt])
}
```

- `category`: `FacilityCategory` enum 문자열 (예: `'parking'`, `'toilet'`)
- `facilityId`: 각 시설 모델의 primary key를 문자열로 직렬화한 값 (시설 모델마다 PK 타입이 달라도 String 하나로 통일 — 외래키는 걸지 않음, 단순 인덱싱용)
- `category + facilityId` 복합 유니크 인덱스
- `videos`는 `[{ videoId, title, channelTitle, thumbnail, publishedAt, duration }]` 형태 JSON
- `itemCount=0`도 정상 캐시 (negative caching — 결과 없는 검색을 30일 저장해 재호출 차단)

### TTL
- 30일 (`expiresAt = fetchedAt + 30d`)
- 시설별 관련 영상이 자주 바뀌지 않으므로 충분히 김. quota 보호 효과 큼

### API 엔드포인트

```
GET /api/facilities/:category/:id/youtube
응답: { success: true, data: { videos: [...] } }
```

- `validate(Schema, 'params')` 미들웨어로 카테고리/ID 검증
- `asyncHandler()`로 래핑 (프로젝트 컨벤션)
- 에러는 글로벌 에러 핸들러가 처리, 정상 경로에서는 항상 200 + `videos` 배열 (빈 배열도 정상 응답)

### 처리 흐름
1. 캐시 조회 (`category + facilityId`, `expiresAt > now`)
2. 캐시 히트 → `videos` 즉시 반환
3. 캐시 미스 → 일일 quota guard 체크
4. quota 여유 있음 → 쿼리 빌드 → YouTube Data API 호출 → 필터링 → 캐시 저장 → 반환
5. quota 소진 → 빈 배열 반환, 운영 로그 남김 (캐시 저장 안 함, 재시도 가능)
6. YouTube API 4xx/5xx → 빈 배열 반환, 캐시 저장 안 함 (재시도 가능)

### Quota guard (`youtubeQuotaService.ts`)
- 메모리 카운터 + 일 단위 리셋 (KST 자정 기준)
- YouTube Data API 무료 일일 한도 10,000 units, `search.list` = 100 units
- 일일 90회까지만 새 검색 허용 (10회 여유)
- 한도 도달 시 새 검색 차단, 캐시만 반환
- `QuotaCounter` 인터페이스로 추상화 → 추후 Redis로 옮길 수 있게

### 동시성
- 동일 `category + facilityId`에 동시 요청 → in-flight Map으로 중복 API 호출 방지

### 사전 워밍업
- 없음. lazy 채우기로 충분 (사이트맵 27만 페이지 중 실제 트래픽 가는 페이지에 자연스럽게 캐시 누적)

## 4. 프론트엔드 컴포넌트 & 성능

### 컴포넌트 구조

```
frontend/components/facility/youtube/
├── FacilityYoutubeSection.vue   # 섹션 컨테이너 (IntersectionObserver, 0건이면 숨김)
├── YoutubeVideoCard.vue          # 썸네일 + 제목 + 채널명 카드
└── YoutubeEmbedModal.vue         # iframe 임베드 모달 (Teleport to body)
```

### Composable

`frontend/composables/useFacilityYoutube.ts`

```ts
const { videos, loading, fetchVideos } = useFacilityYoutube(category, facilityId)
// 내부에서 useAsyncData/$fetch로 /api/facilities/:category/:id/youtube 호출
// fetchVideos는 IntersectionObserver 트리거 시 호출
```

- `readonly()` ref 반환 (프로젝트 컨벤션)
- `$fetch` + `useRuntimeConfig().public.apiBase`

### 로딩 전략 — Lazy CSR
- SSR로 영상 데이터 가져오지 않음 (첫 페인트 차단 X, quota 소진 시 SSR 빈 결과 캐시 위험 회피)
- 섹션이 뷰포트 200px 위로 들어오면 `IntersectionObserver`가 fetch 트리거
- 스켈레톤 카드 6개 표시 → 응답 도착하면 교체 → 결과 < 2개면 섹션 DOM 제거
- `import.meta.client` 가드 적용 (SSR hydration 안전)

### 모달 UX
- 카드 클릭 → 모달 열림 → `<iframe src="https://www.youtube-nocookie.com/embed/{videoId}?autoplay=1&rel=0">`
- ESC, 배경 클릭, 닫기 버튼으로 닫힘
- 닫힐 때 iframe DOM 제거 (자동재생 정지)
- 모바일: 풀스크린, 데스크톱: 중앙 다이얼로그 + 어두운 백드롭
- 모달은 클릭 전까지 mount 안 됨 (`v-if`)

### Schema markup (VideoObject)
- 캐시에 영상이 존재할 때만 SSR 시점에 `<script type="application/ld+json">` 출력
- 상위 6개 영상 각각에 `name`, `description`, `thumbnailUrl`, `uploadDate`, `embedUrl`, `contentUrl` 포함
- 캐시 미스 상태에서는 schema 출력 안 함 (SSR이 API를 호출하지 않음)
- 한 번 캐싱된 페이지부터 schema가 색인됨 → 점진적 효과

### 성능 디테일
- 썸네일: YouTube 제공 `mqdefault.jpg` (320×180)
- `<img loading="lazy" decoding="async">`
- 모달/iframe은 클릭 시점에만 생성
- CLAUDE.md 디자인 토큰 준수 (라이트, 미니멀, 그라데이션·네온 금지)

## 5. 테스트 전략

프로젝트 메모리: TDD 워크플로우 선호 — 테스트 먼저 작성 후 구현.

### 백엔드 (vitest)

`backend/__tests__/services/youtubeService.test.ts`
- `buildYoutubeQuery(facility, category)` — 카테고리별 쿼리 문자열 생성 (parking/toilet/park/library/hospital/school/market/ev-charger 케이스)
- 결과 필터링 — 광고 키워드 차단, 채널 차단, `videoEmbeddable=false` 결과 제외
- YouTube API mock (`fetch` mock 또는 `msw/node`) — 정상 응답, 4xx, 5xx, 네트워크 에러
- 비정상 응답 시 빈 배열 반환

`backend/__tests__/services/youtubeCacheService.test.ts`
- 캐시 히트/미스 분기
- TTL 만료 처리
- `itemCount=0` negative caching
- 동일 facilityId 동시 호출 시 in-flight Map으로 중복 API 호출 방지

`backend/__tests__/services/youtubeQuotaService.test.ts`
- 카운터 증가, 한도 도달 시 false 반환
- 자정 리셋 (시간 mock)

`backend/__tests__/routes/facilityYoutube.test.ts`
- 라우트 통합 테스트 — validate 미들웨어, asyncHandler 에러 처리, `{ success, data: { videos } }` 응답 형태
- 캐시 서비스 모킹

### 프론트엔드 (vitest + happy-dom)

`frontend/tests/composables/useFacilityYoutube.test.ts`
- `$fetch` mock — 정상 응답 시 `videos.value` 채워짐
- 에러 시 빈 배열 + 에러 없는 UI

`frontend/tests/components/facility/youtube/FacilityYoutubeSection.test.ts`
- videos가 2개 미만이면 컴포넌트가 렌더링 안 됨
- 6개 이상이면 6개만 표시
- 스켈레톤 → 카드 전환

`frontend/tests/components/facility/youtube/YoutubeVideoCard.test.ts`
- 썸네일/제목/채널 표시
- 클릭 시 `select` 이벤트 emit (videoId 페이로드)

`frontend/tests/components/facility/youtube/YoutubeEmbedModal.test.ts`
- 열림/닫힘 상태
- iframe src에 videoId 포함
- 닫히면 iframe DOM 제거
- ESC 키, 배경 클릭으로 닫기

### MSW
`frontend/mocks/handlers/facilityYoutube.ts` — 개발 환경에서 백엔드 없이 가짜 영상 응답. 카테고리/시설별 다른 영상 세트 반환.

### E2E (옵션)
- 시설 상세 진입 → 스크롤 → 영상 섹션 노출 → 카드 클릭 → 모달 열림 → 닫힘
- MVP에서는 옵션. 백엔드 캐시 의존성 있어서 fixture 필요

### 커밋 전 체크
- `cd backend && npm run test`
- `cd frontend && npm run test`
- 기존 실패 테스트 발견 시 즉시 수정 (메모리 룰)

## 6. 카테고리 추가 시 영향

이 설계는 `FacilityCategory` 타입에 자동 대응. 향후 새 카테고리 추가 시:
- `youtubeService.ts`의 쿼리 패턴 맵에 카테고리 추가
- 별도 마이그레이션 불필요 (캐시 테이블은 `category: String` 그대로 수용)

## 7. 보안 & 운영

- YouTube API 키는 `.env`에만, 커밋 금지. `.env.example`은 빈 placeholder
- GCP 콘솔에서 API 제한(YouTube Data API v3만) + IP 화이트리스트 설정
- 프로젝트 완료 후 키 회전 권장 (대화 로그에 노출된 적 있음)
- 일일 quota 90% 도달 시 운영 로그/알림 (이후 작업)

## 8. 비범위 (Out of scope)

- 부동산/청약/지하철 상세 페이지 적용 (다음 이터레이션)
- 네이버 블로그 후기 섹션 (별도 이터레이션)
- 영상 신고/숨김 기능
- 채널 평판 점수
- E2E 테스트 (MVP 이후)
- 일일 quota 알림 시스템
- 사전 워밍업 배치
