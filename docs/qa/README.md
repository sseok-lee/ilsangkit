# QA 문서 디렉토리

일상킷 프로젝트의 품질 보증 (QA) 관련 문서 모음입니다.

## 문서 목록

### 1. [크로스 브라우저 테스트 체크리스트](./cross-browser-checklist.md)
- **목적**: 모든 주요 브라우저에서 기능 검증
- **대상 브라우저**: Chrome, Safari, Firefox, Samsung Internet
- **플랫폼**: Desktop, iOS, Android
- **사용 시기**:
  - 프로덕션 배포 전 필수 확인
  - 주요 기능 추가/변경 후
  - 분기별 정기 점검

### 2. [브라우저 스모크 테스트 시나리오](./browser-smoke-test.md)
- **목적**: 핵심 기능 빠른 수동 검증
- **소요 시간**: 브라우저당 5분
- **5가지 시나리오**:
  1. 홈 페이지 접속 및 카테고리 탐색
  2. 위치 기반 검색
  3. 키워드 검색 및 필터링
  4. 시설 상세 정보 조회
  5. 쓰레기 배출 일정 조회
- **사용 시기**:
  - Hot Fix 배포 후 즉시 확인
  - 긴급 회귀 테스트

## 테스트 전략

### 자동화 vs 수동 테스트

| 테스트 유형 | 도구 | 빈도 | 커버리지 |
|------------|------|------|---------|
| **유닛 테스트** | Vitest | 매 커밋 | ~80% |
| **통합 테스트** | Vitest + Supertest | 매 PR | API 100% |
| **E2E 테스트** | Playwright | 매 배포 | 핵심 플로우 |
| **크로스 브라우저** | 수동 + Playwright | 주간/배포 시 | 주요 브라우저 |
| **성능 테스트** | Lighthouse | 배포 후 | Core Web Vitals |
| **접근성 테스트** | axe-core | 월간 | WCAG 2.1 AA |

### 우선순위 정의

- **P0 (Critical)**: Chrome Desktop/Mobile, Safari iOS - 매 배포 시 필수
- **P1 (High)**: Samsung Internet, Firefox - 주간 확인
- **P2 (Medium)**: Edge, 구형 브라우저 - 분기별 확인

## Playwright 크로스 브라우저 설정

현재 설정된 브라우저 프로젝트:

```typescript
// playwright.config.ts
projects: [
  { name: 'chromium', use: devices['Desktop Chrome'] },
  { name: 'firefox', use: devices['Desktop Firefox'] },
  { name: 'webkit', use: devices['Desktop Safari'] },
  { name: 'Mobile Chrome', use: devices['Pixel 5'] },
  { name: 'Mobile Safari', use: devices['iPhone 14'] },
  { name: 'Tablet', use: { viewport: { width: 768, height: 1024 } } },
  { name: 'iPhone SE', use: devices['iPhone SE'] },
  { name: 'Samsung Galaxy', use: devices['Galaxy S9+'] },
]
```

### 실행 명령어

```bash
# 모든 브라우저 테스트
npm run test:e2e

# 특정 브라우저만 테스트
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=firefox
npm run test:e2e -- --project=webkit

# 특정 모바일 디바이스
npm run test:e2e -- --project="Mobile Safari"
npm run test:e2e -- --project="iPhone SE"

# UI 모드로 실행 (디버깅)
npm run test:e2e -- --ui

# 헤드풀 모드 (브라우저 표시)
npm run test:e2e -- --headed --project=chromium
```

## 실제 디바이스 테스트

### Android 디바이스
1. USB 디버깅 활성화
2. Chrome DevTools → Remote Devices
3. 개발 서버를 로컬 네트워크에 노출
   ```bash
   npm run dev -- --host 0.0.0.0
   ```
4. 디바이스에서 `http://<your-ip>:3000` 접속

### iOS 디바이스 (macOS 필요)
1. Safari > 개발자 메뉴 > iPhone 선택
2. Web Inspector 실행
3. 콘솔 에러 및 네트워크 확인

## 알려진 브라우저별 이슈

### Safari (iOS)
- **100vh 문제**: `dvh` 단위 사용 또는 JS로 계산
- **Backdrop filter 성능**: 투명도 조정 필요
- **Touch delay**: `touch-action: manipulation` 추가

### Samsung Internet
- **CSS Grid gap**: 구버전 미지원 → margin 대체
- **WebP 지원**: 최신 버전만 지원

### Firefox
- **Scrollbar styling**: `::-webkit-scrollbar` 미지원 → `scrollbar-width` 사용

자세한 내용은 [크로스 브라우저 체크리스트](./cross-browser-checklist.md#알려진-이슈-및-대응-방안)를 참고하세요.

## 버그 리포트 프로세스

1. **이슈 발견 시**
   - [browser-smoke-test.md](./browser-smoke-test.md)의 버그 리포트 템플릿 사용
   - GitHub Issue 생성 (Label: `bug`, `browser-compatibility`)
   - 스크린샷/비디오 첨부

2. **재현율 확인**
   - 100%: P0 (즉시 수정)
   - 50~99%: P1 (다음 배포에 포함)
   - <50%: P2 (백로그 등록)

3. **수정 후 검증**
   - 동일 브라우저에서 재테스트
   - 회귀 테스트 (다른 브라우저도 확인)

## 테스트 커버리지 목표

| 영역 | 목표 | 현재 | 상태 |
|------|------|------|------|
| Backend API | 80% | TBD | 🟡 |
| Frontend Components | 70% | TBD | 🟡 |
| E2E Critical Paths | 100% | TBD | 🟡 |
| Cross-Browser | P0 100% | 0% | 🔴 |

## 추가 참고 자료

- [Playwright 공식 문서](https://playwright.dev/)
- [Can I Use](https://caniuse.com/) - 브라우저 호환성 확인
- [BrowserStack](https://www.browserstack.com/) - 클라우드 테스트 플랫폼
- [MDN Web Docs](https://developer.mozilla.org/) - 웹 표준 레퍼런스

## 관련 문서

- [프로젝트 루트 CLAUDE.md](../../CLAUDE.md) - 전체 아키텍처
- [개발 태스크 목록](../planning/06-tasks.md) - Phase별 작업 계획
- [TRD](../planning/02-trd.md) - 기술 요구사항

---

**작성일**: 2026-02-12
**작성자**: test-specialist
**Phase**: 14 (QA 문서화)
