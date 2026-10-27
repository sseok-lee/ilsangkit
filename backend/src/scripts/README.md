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

### 부동산 지도 면적·가격 요약 백필

`202610270001_building_area_summary/migration.sql`을 적용한 뒤 실행한다. 실행 환경의
`REAL_ESTATE_WRITE_LOCK_DIR`는 거래 동기화·V2 갱신과 같은 경로여야 한다.

```bash
# 전체 유형 초기 채우기 (기본 25단지, 배치 사이 100ms 대기)
npx tsx src/scripts/backfillRealEstateAreaSummary.ts
# 유형별 또는 법정동 코드별 사전 계산
npx tsx src/scripts/backfillRealEstateAreaSummary.ts --type apt-rent --bjd-code 11680
# 중단된 동일 범위의 마지막 완료 배치부터 재개
npx tsx src/scripts/backfillRealEstateAreaSummary.ts --type apt-rent --resume
```

`--type`은 쉼표로 여러 유형을 받는다. `--batch-size 1..100`, `--pause-ms 0..10000`으로
부하를 조절한다. 6시간 watchdog과 종료 신호 처리, 기존 writer 잠금을 사용한다.
진행 로그에는 유형·지역·단지 수·마지막 키·경과 시간이 나온다.

면적 제한 없음(0)과 네 면적 구간(1~4)을 `getLatestDeals`로 계산한다. 단지 배치 upsert와
커서 저장은 같은 트랜잭션이다. 구간에 거래가 없어도 빈 묶음을 저장한다. 마지막에는
V2에서 사라진 단지를 500행씩 삭제하고 단지마다 다섯 구간이 있는지 확인한다.

지역 백필만으로 유형 전체를 준비 완료로 표시하지 않는다. 최초 전체 유형 백필 완료 전
필터 요청은 `503 MAP_FILTERS_PREPARING`을 반환한다. 기존 완료 상태는 재갱신 중 유지한다.
중단 사이 원본/V2를 갱신했다면 `--resume` 없이 처음부터 다시 실행한다. 구간 누락이
발견되어도 준비 완료로 표시하지 않는다. 완료된 범위에 `--resume`은 아무 작업도 하지 않는다.

이후 `refreshRealEstateSummary.ts`와 V2 준비 파이프라인에서 실제 유형별 V2 갱신 성공 뒤
자동으로 갱신한다. 배포 시 **마이그레이션 → 준비 checkout에서 백필 → 서비스 코드 배포**
순서를 지킨다. 백필 중에는 전체 staging 복제 대신 완료된 단지 배치를 순서대로 교체한다.
