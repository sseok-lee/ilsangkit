# Backend Scripts

이 디렉토리는 백엔드 운영에 필요한 스크립트들을 포함합니다.

## 스크립트 목록

### 데이터 동기화

| 스크립트 | 명령어 | 설명 |
|---------|--------|------|
| `syncToilet.ts` | `npm run sync:toilet` | 공공화장실 데이터 동기화 (CSV) |
| `syncWifi.ts` | `npm run sync:wifi` | 무료 와이파이 데이터 동기화 (CSV) |
| `syncTrash.ts` | `npm run sync:trash` | 생활쓰레기 배출함 동기화 (API) |
| `syncClothes.ts` | `npm run sync:clothes` | 의류수거함 데이터 동기화 (CSV) |
| `syncKiosk.ts` | `npm run sync:kiosk` | 무인민원발급기 동기화 (API + 지오코딩) |
| `syncParking.ts` | `npm run sync:parking` | 공영주차장 데이터 동기화 (CSV) |
| `syncAed.ts` | `npm run sync:aed` | AED 위치 데이터 동기화 (API) |
| `syncRegion.ts` | `npm run sync:regions` | 지역 정보 동기화 |
| `syncAll.ts` | `npm run sync:facilities` | 전체 카테고리 통합 동기화 |

### 부하 테스트

| 스크립트 | 명령어 | 설명 |
|---------|--------|------|
| `loadTest.ts` | `npm run test:load` | API 성능 부하 테스트 |

## 사용 예시

### 전체 데이터 동기화
```bash
cd backend
npm run sync:facilities
```

### 특정 카테고리만 동기화
```bash
# 화장실과 와이파이만
npm run sync:facilities -- --only toilet,wifi

# 키오스크 제외하고 전체
npm run sync:facilities -- --skip kiosk
```

### 부하 테스트 실행
```bash
# 기본 실행 (전체 시나리오)
npm run test:load

# 검색 API만 테스트
npm run test:load -- --scenario search

# 동시 접속 500, 60초간 테스트
npm run test:load -- --connections 500 --duration 60
```

## 환경 변수

스크립트 실행에 필요한 환경 변수:

```bash
# backend/.env
DATABASE_URL=mysql://user:password@localhost:3306/ilsangkit
OPENAPI_SERVICE_KEY=your-api-key  # 공공데이터포털 API 키
```

## 주의사항

1. **데이터 동기화**
   - 초기 실행 시 시간이 오래 걸릴 수 있습니다 (5-10분)
   - 네트워크 상태에 따라 실패할 수 있으므로 재실행 가능
   - 지오코딩(kiosk)은 API rate limit 때문에 가장 마지막에 실행됨

2. **부하 테스트**
   - 반드시 개발 환경에서 먼저 테스트
   - 프로덕션 테스트 시 트래픽 영향 고려
   - Rate limiting 비활성화 필요 (정확한 측정을 위해)

## 문서

- **부하 테스트 가이드**: [../../docs/qa/load-test-guide.md](../../docs/qa/load-test-guide.md)
- **데이터 동기화 전략**: [../../docs/planning/02-trd.md](../../docs/planning/02-trd.md)

## 트러블슈팅

### "OPENAPI_SERVICE_KEY가 설정되지 않았습니다" 에러
```bash
# .env 파일에 API 키 추가
echo "OPENAPI_SERVICE_KEY=your-key-here" >> .env
```

### "Toilet CSV 파일이 없습니다" 에러
```bash
# 공공화장실 데이터는 별도 다운로드 필요
npm run sync:toilet  # CSV 파일 자동 다운로드
```

### MySQL 연결 오류
```bash
# Docker로 MySQL 실행
docker compose up -d

# 또는 로컬 MySQL 서비스 시작
brew services start mysql
```
