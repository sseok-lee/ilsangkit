# 크로스 브라우저 테스트 빠른 참조 가이드

## 테스트 실행 명령어

### Playwright 자동 테스트

```bash
# 모든 브라우저에서 모든 테스트 실행
npm run test:e2e

# 특정 브라우저만 테스트
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=firefox
npm run test:e2e -- --project=webkit

# 모바일 브라우저
npm run test:e2e -- --project="Mobile Chrome"
npm run test:e2e -- --project="Mobile Safari"
npm run test:e2e -- --project="iPhone SE"

# UI 모드로 실행 (디버깅)
npm run test:e2e -- --ui

# 헤드풀 모드 (브라우저 표시)
npm run test:e2e -- --headed --project=chromium

# 특정 테스트 파일만
npm run test:e2e -- responsive-layout.spec.ts

# P0 브라우저만 (Chrome, Safari)
npm run test:e2e -- --project=chromium --project=webkit --project="Mobile Safari"
```

---

## 수동 테스트 체크리스트

### 긴급 회귀 테스트 (2분)

Hot Fix 배포 후 즉시 확인:

```
[ ] 1. https://ilsangkit.co.kr 접속 성공
[ ] 2. 8개 카테고리 카드 표시
[ ] 3. "화장실" 클릭 → 검색 페이지 이동
[ ] 4. 키워드 "강남역" 검색 → 결과 표시
[ ] 5. 첫 번째 시설 클릭 → 상세 페이지
```

### 5분 스모크 테스트

각 브라우저에서 확인:

```
[ ] 1. 홈 페이지 접속 및 카테고리 탐색 (30초)
[ ] 2. 위치 기반 검색 (1분)
[ ] 3. 키워드 검색 및 필터링 (45초)
[ ] 4. 시설 상세 정보 조회 (30초)
[ ] 5. 쓰레기 배출 일정 조회 (1분)
```

상세 가이드: [browser-smoke-test.md](./browser-smoke-test.md)

---

## 브라우저 우선순위

### P0 (Critical) - 매 배포 시 필수
- ✅ Chrome Desktop
- ✅ Chrome Mobile (Android)
- ✅ Safari Desktop (macOS)
- ✅ Safari iOS (iPhone)

### P1 (High) - 주간 확인
- Firefox Desktop
- Samsung Internet (Android)

### P2 (Medium) - 분기별 확인
- Edge Desktop
- 구형 브라우저

---

## 테스트 대상 페이지 (11개)

| 페이지 | URL | 핵심 기능 |
|-------|-----|----------|
| 홈 | `/` | 카테고리 카드, 네비게이션 |
| 검색 | `/search` | 지도, 검색, 필터 |
| 시설 상세 | `/:category/:id` | 상세 정보, 지도 |
| 지역 목록 | `/:city` | 시/도별 시설 |
| 지역 구/군 | `/:city/:district` | 구/군별 시설 |
| 지역 카테고리 | `/:city/:district/:category` | 필터링된 시설 |
| 쓰레기 상세 | `/trash/:id` | 배출 일정 |
| 소개 | `/about` | 정적 페이지 |
| 개인정보처리방침 | `/privacy` | 정적 페이지 |
| 이용약관 | `/terms` | 정적 페이지 |

---

## 핵심 체크 포인트

### 레이아웃
```
[ ] 헤더/풋터 정상 표시
[ ] 카테고리 카드 그리드 (2x4, 모바일 1열)
[ ] 검색 페이지 2열 레이아웃 (Desktop)
[ ] 모바일 1열 + FAB 버튼
```

### 카카오 지도
```
[ ] 지도 렌더링 (< 2초)
[ ] 마커 표시 (8개 카테고리)
[ ] 드래그/줌 동작 (Desktop)
[ ] 핀치 줌 (Mobile)
[ ] 인포윈도우 클릭
```

### 검색 기능
```
[ ] 키워드 검색 (Enter)
[ ] 카테고리 필터 칩
[ ] 거리순/이름순 정렬
[ ] 검색어 지우기
```

### 위치 기능
```
[ ] "현재 위치" 버튼
[ ] Geolocation 권한 요청
[ ] 거리 표시 (km)
[ ] 지도 중심 이동
```

### 반응형
```
[ ] 320px (iPhone SE)
[ ] 375px (iPhone 14)
[ ] 768px (iPad)
[ ] 1024px (Desktop)
[ ] 1920px (Full HD)
```

---

## 알려진 이슈 빠른 확인

### Safari (iOS)

**이슈**: 100vh 높이 문제
**확인 방법**: 전체 화면 페이지에서 하단 주소창에 가려지는지 확인
**대응**: `dvh` 단위 사용

**이슈**: Touch Delay
**확인 방법**: 버튼 클릭 시 300ms 지연 느껴지는지
**대응**: `touch-action: manipulation`

### Samsung Internet

**이슈**: CSS Grid Gap
**확인 방법**: 카드 간격이 비정상인지 확인
**대응**: `margin` 대체

### Firefox

**이슈**: Scrollbar Styling
**확인 방법**: 커스텀 스크롤바가 표시되는지
**대응**: `scrollbar-width` 속성

---

## 성능 검증

### Lighthouse (Chrome DevTools)

```bash
# 개발자 도구 열기
F12 → Lighthouse 탭

# 체크 항목
[ ] Performance: 80+
[ ] Accessibility: 90+
[ ] Best Practices: 90+
[ ] SEO: 90+
```

### Core Web Vitals

```
[ ] LCP (Largest Contentful Paint): < 2.5초
[ ] FID (First Input Delay): < 100ms
[ ] CLS (Cumulative Layout Shift): < 0.1
```

---

## 버그 발견 시 액션

### 1. 재현 단계 기록
```markdown
**브라우저**: Safari 17.2 (iOS 17.3)
**디바이스**: iPhone 14 Pro
**재현율**: 100%

**재현 단계**:
1. /search 접속
2. "현재 위치" 버튼 클릭
3. 권한 허용

**기대**: 위치 기반 시설 목록 표시
**실제**: "위치를 가져올 수 없습니다" 에러
```

### 2. GitHub Issue 생성
- Label: `bug`, `browser-compatibility`
- Assignee: 담당자 지정
- 스크린샷/비디오 첨부

### 3. 우선순위 판단
- **100% 재현**: P0 (즉시 수정)
- **50~99% 재현**: P1 (다음 배포)
- **<50% 재현**: P2 (백로그)

---

## 실제 디바이스 테스트

### Android (Chrome DevTools)

```bash
# 1. USB 디버깅 활성화
# 2. Chrome → chrome://inspect/#devices

# 3. 개발 서버 네트워크 노출
cd frontend
npm run dev -- --host 0.0.0.0

# 4. 디바이스에서 접속
# http://<your-ip>:3000
```

### iOS (Safari Web Inspector)

```bash
# 1. iPhone 설정 → Safari → 고급 → 웹 인스펙터
# 2. Mac Safari → 개발자 메뉴 → iPhone 선택
# 3. 콘솔 에러 및 네트워크 확인
```

---

## 자동화 vs 수동 판단

### 자동화 (Playwright)
- ✅ 레이아웃 렌더링 검증
- ✅ 키워드 검색 + 필터링
- ✅ 시설 상세 페이지 조회
- ✅ 쓰레기 일정 선택

### 수동 (실제 브라우저)
- ⚠️ Geolocation API (Mocking 복잡)
- ⚠️ 카카오 지도 상호작용 (시각적 확인)
- ⚠️ 터치 제스처 (핀치 줌)
- ⚠️ 성능 체감 (부드러움)

---

## 배포 전 최종 체크리스트

### 1. 자동 테스트 실행

```bash
# P0 브라우저 자동 테스트
npm run test:e2e -- --project=chromium --project=webkit --project="Mobile Safari"
```

### 2. 수동 스모크 테스트 (15분)

| 브라우저 | 시간 | 상태 |
|---------|------|------|
| Chrome Desktop | 5분 | [ ] |
| Safari iOS | 5분 | [ ] |
| Chrome Mobile | 5분 | [ ] |

### 3. 성능 검증

```
[ ] Lighthouse 점수 (Performance 80+)
[ ] 초기 로딩 < 3초
[ ] 검색 응답 < 1초
[ ] 지도 렌더링 < 2초
```

### 4. 접근성 검증

```
[ ] Tab 키 네비게이션
[ ] 포커스 표시 명확
[ ] Enter/Space 키 동작
[ ] Escape 키로 모달 닫기
```

### 5. 다크모드 확인

```
[ ] 다크모드 전환 버튼
[ ] 시스템 설정 연동
[ ] 텍스트 가독성
[ ] 지도 다크 테마
```

---

## 관련 문서 링크

- [크로스 브라우저 체크리스트](./cross-browser-checklist.md) - 전체 테스트 항목
- [브라우저 스모크 테스트](./browser-smoke-test.md) - 5가지 시나리오 상세
- [QA README](./README.md) - 테스트 전략 및 우선순위

---

## 자주 사용하는 명령어

```bash
# Playwright 설치
npm install -D @playwright/test

# 브라우저 설치
npx playwright install

# 특정 브라우저만 설치
npx playwright install chromium
npx playwright install firefox
npx playwright install webkit

# 테스트 리포트 열기
npx playwright show-report

# 설정 확인
npx playwright test --list
```

---

**마지막 업데이트**: 2026-02-12
**작성자**: test-specialist
