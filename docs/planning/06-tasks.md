# 06. 개발 태스크 목록 (TASKS)

> 일상킷 - 내 주변 생활 편의 정보, 한 번에 찾기

---

## 마일스톤 개요

| 마일스톤 | 설명 | Phase | 상태 |
|----------|------|-------|------|
| M0 | 프로젝트 셋업 | Phase 0 | ✅ 완료 |
| M0.5 | 계약 & 테스트 기반 | Phase 0 | ✅ 완료 |
| M1 | 백엔드 핵심 API | Phase 1 | ✅ 완료 |
| M2 | 공공데이터 동기화 (6개 카테고리) | Phase 2 | ✅ 완료 |
| M3 | 프론트엔드 핵심 UI | Phase 3 | ✅ 완료 |
| M4 | 지도 연동 | Phase 4 | ✅ 완료 |
| M5 | SEO 최적화 | Phase 5 | ✅ 완료 |
| M6 | 배포 & 모니터링 | Phase 6 | ✅ 완료 |
| M7 | 디자인 목업 반영 | Phase 7 | ✅ 완료 |
| M8 | 기술 부채 해결 | Phase 8 | ✅ 완료 |
| M9 | 신규 카테고리 추가 (공영주차장, AED, 공공도서관) | Phase 9 | ✅ 완료 |
| M10+ | 리팩토링 & 추가 카테고리 | Phase 10+ | 📋 예정 |

---

## 현재 구현 현황 요약

### ✅ 완료된 항목

#### Phase 0: 프로젝트 셋업 & 계약
- [x] 백엔드 초기화 (Express + TypeScript + Vitest)
- [x] 프론트엔드 초기화 (Nuxt 3 + TailwindCSS)
- [x] Docker 환경 설정
- [x] Prisma 스키마 정의 (8개 카테고리)
- [x] API 계약 정의 & Mock 설정

#### Phase 1: 백엔드 핵심 API
- [x] 시설 검색 API (`POST /api/facilities/search`)
- [x] 시설 상세 API (`GET /api/facilities/:category/:id`)
- [x] 지역별 조회 API (`GET /api/facilities/region/:city/:district/:category`)
- [x] 메타 API (카테고리, 지역, 헬스체크)

#### Phase 2: 공공데이터 동기화
- [x] 공공화장실 동기화 (CSV)
- [x] 쓰레기 배출 동기화 (API)
- [x] 무료 와이파이 동기화 (CSV)
- [x] 의류수거함 동기화 (API)
- [x] 무인민원발급기 동기화 (API + Kakao 지오코딩)
- [x] 통합 동기화 스케줄러

#### Phase 3: 프론트엔드 핵심 UI
- [x] 레이아웃 및 공통 컴포넌트
- [x] 메인 페이지 (카테고리 그리드)
- [x] 검색 결과 페이지
- [x] 상세 페이지 (6개 카테고리별 UI)
- [x] 지역별 페이지 (SSG 지원)

#### Phase 4: 지도 연동
- [x] Kakao Maps 연동
- [x] 현재 위치 기반 검색 (Geolocation API)

#### Phase 5: SEO 최적화
- [x] 메타태그 (Open Graph, Twitter Card, Canonical)
- [x] 사이트맵 (동적 생성, 50K URL 자동 분할)
- [x] robots.txt & JSON-LD

#### Phase 6: 배포 & 모니터링
- [x] GitHub Actions CI/CD
- [x] 카페24 서버 배포
- [x] Google Analytics & Search Console

#### Phase 7: 디자인 목업 반영
- [x] 랜딩 페이지 (카테고리 카드)
- [x] 검색 결과 페이지 (좌측 목록 + 우측 지도)
- [x] 상세 페이지 (데스크톱 + 모바일)

#### Phase 8: 기술 부채 해결
- [x] 타입 파일 통합
- [x] 지역 슬러그 동적 생성
- [x] 중간 라우트 추가 (`/[city]`, `/[city]/[district]`)
- [x] ErrorBoundary 컴포넌트
- [x] 모바일 전체화면 지도

#### Phase 9: 신규 카테고리 추가
- [x] 공영주차장 (parking) - 데이터 동기화, API, UI
- [x] 자동심장충격기 (aed) - XML API 파싱, 60,917건 동기화
- [x] 공공도서관 (library) - API 동기화, UI 구현

### 📋 예정된 항목

#### Phase 10: 리팩토링
- [ ] facilityService switch-case → 레지스트리 패턴
- [ ] 헤더/카테고리 네비게이션 UI 재설계 (8개 이상 대응)
- [ ] 동기화 서비스 공통 추상화

#### Phase 11+: 추가 카테고리 확장
- [ ] 전기차 충전소 (ev) - 43만건 대규모 데이터
- [ ] 약국 (pharmacy) - 좌표계 변환 필요 (EPSG:5174 → WGS84)
- [ ] 도시공원, 폐형광등/건전지, 안심택배함 등

---

## 현재 구현된 8개 카테고리 요약

| # | 카테고리 | 데이터 소스 | 동기화 | API | UI | 상태 |
|---|---------|-----------|--------|-----|----|----|
| 1 | 공공화장실 | CSV | ✅ | ✅ | ✅ | ✅ 완료 |
| 2 | 쓰레기 배출 | Open API | ✅ | ✅ | ✅ | ✅ 완료 |
| 3 | 무료 와이파이 | CSV | ✅ | ✅ | ✅ | ✅ 완료 |
| 4 | 의류수거함 | Open API | ✅ | ✅ | ✅ | ✅ 완료 |
| 5 | 무인민원발급기 | Open API | ✅ (Kakao 지오코딩) | ✅ | ✅ | ✅ 완료 |
| 6 | 공영주차장 | CSV | ✅ | ✅ | ✅ | ✅ 완료 |
| 7 | AED | XML API | ✅ (60,917건) | ✅ | ✅ | ✅ 완료 |
| 8 | 공공도서관 | Open API | ✅ | ✅ | ✅ | ✅ 완료 |

---

## TASKS.md 문서 위치

- **메인 기획**: `/docs/planning/06-tasks.md` (이 파일)
- **신규 카테고리**: `/docs/planning/09-new-categories-tasks.md` (M9~M12 상세 정의)

---

## 개발 팀 역할 분담

### 에이전트 & 담당 범위

| 에이전트 | 담당 영역 | 관련 Phase |
|---------|---------|-----------|
| **backend-specialist** | Express API, Prisma, 데이터 동기화 | M0, M1, M2, M9, M10 |
| **frontend-specialist** | Nuxt UI, 레이아웃, 페이지 | M3, M4, M7, M10 |
| **database-specialist** | Prisma 스키마, 마이그레이션 | M0.4, M9, M10 |
| **test-specialist** | TDD, 테스트 작성 | M0.5, M9 |

---

## 완료 체크리스트

### 핵심 기능
- [x] 8개 카테고리 데이터 동기화 완료
- [x] API 검색 엔드포인트 정상 동작
- [x] 프론트엔드 UI 모든 페이지 구현 완료
- [x] 지도 기능 정상 동작
- [x] SEO 메타태그 적용
- [x] 사이트맵 생성 (50K URL 자동 분할)
- [x] 배포 자동화 (GitHub Actions)

### 테스트 & 품질
- [x] 백엔드 테스트 전체 통과
- [x] 프론트엔드 테스트 전체 통과
- [x] E2E 테스트 (Playwright) 작성 및 통과
- [x] ESLint 에러 0
- [x] TypeScript 타입 검사 통과

### 반응형 웹
- [x] Mobile 우선 설계 (< 640px)
- [x] Tablet 레이아웃 (640px ~ 1024px)
- [x] Desktop 2컬럼 레이아웃 (> 1024px)
- [x] 모든 터치 타겟 44x44px 이상
- [x] Playwright 반응형 테스트 자동화

### 성능
- [x] Lighthouse Performance 점수 90+ (Desktop)
- [x] Lighthouse SEO 점수 90+
- [x] WebP 이미지 최적화 (PNG → WebP 변환)
- [x] 정적 자산 캐싱

---

## 다음 단계 (Phase 10+)

### Phase 10: 리팩토링
1. **레지스트리 패턴**: facilityService.ts의 switch-case 제거
   - 새 카테고리 추가 시 단순 등록만으로 완료
   - 기존 8개 카테고리 회귀 테스트 필수

2. **UI 재설계**: 8개 이상 카테고리 대응
   - 헤더 네비게이션 드롭다운/더보기 메뉴
   - 홈 카테고리 그리드 확장성 개선
   - 검색 탭 필터 반응형 개선

3. **동기화 공통 추상화**: BaseSyncService
   - CSV, API, XML 파싱 통합
   - 배치 upsert, 증분 동기화 표준화
   - 로그 포맷 통일

### Phase 11: 추가 카테고리 (4~5순위)
- **전기차 충전소 (ev)**: 43만건 대규모 데이터, API 제한 고려
- **약국 (pharmacy)**: 좌표계 변환 (EPSG:5174 → WGS84)

### Phase 12: 추가 확장 (선택)
- **도시공원, 폐형광등/건전지, 안심택배함** 등

---

## 참고 자료

### 관련 문서
- `01-prd.md` — 제품 요구사항 정의서
- `04-database-design.md` — DB 설계 명세
- `09-new-categories-tasks.md` — 신규 카테고리 상세 태스크

### 데이터 소스
- [공공데이터포털](https://www.data.go.kr)
- [국토교통부 법정동코드](https://www.data.go.kr/data/15123287/fileData.do)

### 개발 가이드
- `CLAUDE.md` — 프로젝트 설정 및 명령어
- `.claude/agents/` — 에이전트별 역할 정의

---

## 최근 업데이트

- **2026-02-12**: Phase 9 완료 후 기획 문서 현행화
  - 8개 카테고리 모두 구현 완료 반영
  - DB 설계 최신 상태 동기화
  - Phase 10+ 로드맵 정리
