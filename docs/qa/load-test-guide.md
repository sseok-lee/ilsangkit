# 부하 테스트 가이드

이 문서는 일상킷 API 서버의 부하 테스트 수행 방법과 성능 기준을 설명합니다.

## 목차

- [테스트 환경 요구사항](#테스트-환경-요구사항)
- [부하 테스트 시나리오](#부하-테스트-시나리오)
- [테스트 실행 방법](#테스트-실행-방법)
- [성능 기준](#성능-기준)
- [Kakao API 쿼터 관리](#kakao-api-쿼터-관리)
- [문제 해결](#문제-해결)

---

## 테스트 환경 요구사항

### 1. 필수 환경

- **MySQL 서버**: 실행 중이어야 함
  ```bash
  docker compose up -d  # 로컬 MySQL 실행
  ```

- **충분한 테스트 데이터**: 최소 1,000건 이상
  ```bash
  cd backend
  npm run sync:facilities  # 전체 카테고리 동기화
  ```

- **Node.js**: 18 이상
- **메모리**: 최소 4GB RAM 권장

### 2. Rate Limiting 설정

부하 테스트 시 rate limiting을 임시 비활성화해야 정확한 성능 측정이 가능합니다.

**방법 1: 환경 변수 설정**
```bash
# backend/.env.test 파일 생성
RATE_LIMIT_ENABLED=false
```

**방법 2: 코드 임시 수정** (개발 환경만)
```typescript
// backend/src/middlewares/rateLimit.ts
export const searchRateLimiter = (req, res, next) => {
  // 부하 테스트 시 임시로 주석 처리
  // if (process.env.NODE_ENV === 'production') { ... }
  next();
};
```

⚠️ **주의**: 테스트 완료 후 반드시 원상복구하세요!

### 3. 데이터베이스 최적화

테스트 전 인덱스 확인:
```sql
-- 검색 성능을 위한 인덱스 확인
SHOW INDEX FROM Toilet;
SHOW INDEX FROM Wifi;
SHOW INDEX FROM Clothes;
SHOW INDEX FROM Kiosk;
SHOW INDEX FROM Parking;
SHOW INDEX FROM Aed;
SHOW INDEX FROM Library;

-- 쿼리 성능 확인
EXPLAIN SELECT * FROM Toilet
WHERE latitude BETWEEN 37.0 AND 38.0
AND longitude BETWEEN 126.0 AND 127.0;
```

---

## 부하 테스트 시나리오

### 시나리오 1: 검색 API 부하 테스트

**엔드포인트**: `POST /api/facilities/search`

| 항목 | 값 |
|------|-----|
| 동시 접속 수 | 100 (기본값) |
| 테스트 시간 | 10초 |
| 기대 P95 레이턴시 | < 500ms |
| 기대 처리량 | > 100 req/sec |

**테스트 내용**:
- 서울 주요 지역 5곳의 좌표로 랜덤 검색
- 반경 1km 내 시설 검색
- 페이징 파라미터 포함 (page=1, limit=20)

**성공 기준**:
- 95%의 요청이 500ms 이내 응답
- 에러율 < 1%

### 시나리오 2: 사이트맵 생성 부하 테스트

**엔드포인트**: `GET /api/sitemap/facilities/:category`

| 항목 | 값 |
|------|-----|
| 동시 접속 수 | 10-20 (제한됨) |
| 테스트 시간 | 10초 |
| 기대 P95 레이턴시 | < 2000ms |
| 기대 처리량 | > 5 req/sec |

**테스트 내용**:
- 7개 카테고리를 랜덤 조회
- 각 카테고리별 전체 ID + updatedAt 조회
- 50K+ URL 처리 성능 검증

**성공 기준**:
- 95%의 요청이 2초 이내 응답
- 메모리 사용량 < 512MB

### 시나리오 3: 상세 조회 부하 테스트

**엔드포인트**: `GET /api/facilities/:category/:id`

| 항목 | 값 |
|------|-----|
| 동시 접속 수 | 200 |
| 테스트 시간 | 10초 |
| 기대 P95 레이턴시 | < 200ms |
| 기대 처리량 | > 200 req/sec |

**테스트 내용**:
- 랜덤 카테고리 + ID 조회
- DB 인덱스 성능 검증
- 캐싱 효과 측정

**성공 기준**:
- 95%의 요청이 200ms 이내 응답
- 에러율 < 1% (404 제외)

---

## 테스트 실행 방법

### 1. 기본 실행 (전체 시나리오)

```bash
cd backend
npm run test:load
```

### 2. 특정 시나리오만 실행

```bash
# 검색 API만 테스트
npm run test:load -- --scenario search

# 사이트맵 API만 테스트
npm run test:load -- --scenario sitemap

# 상세 조회 API만 테스트
npm run test:load -- --scenario detail
```

### 3. 설정 변경

```bash
# 동시 접속 수 변경 (기본값: 100)
npm run test:load -- --connections 200

# 테스트 시간 변경 (기본값: 10초)
npm run test:load -- --duration 30

# 복합 설정
npm run test:load -- --scenario search --connections 500 --duration 60
```

### 4. 다른 서버 테스트 (스테이징/프로덕션)

```bash
# 환경 변수로 서버 URL 지정
API_BASE_URL=https://staging.ilsangkit.com npm run test:load

# 프로덕션 서버 테스트 (주의!)
API_BASE_URL=https://ilsangkit.com npm run test:load -- --connections 50
```

⚠️ **프로덕션 환경 테스트 주의사항**:
- 사용자에게 영향을 줄 수 있으므로 트래픽이 적은 시간대에 실행
- 동시 접속 수를 낮게 설정 (50 이하 권장)
- Rate limiting이 활성화되어 있으므로 결과가 제한될 수 있음

---

## 성능 기준

### 응답 시간 (Response Time)

| API | P50 | P95 | P99 |
|-----|-----|-----|-----|
| 검색 API | < 200ms | **< 500ms** | < 1000ms |
| 상세 조회 | < 100ms | **< 200ms** | < 500ms |
| 사이트맵 | < 1000ms | **< 2000ms** | < 3000ms |

**P95**: 95%의 요청이 해당 시간 내에 완료되어야 함 (핵심 지표)

### 처리량 (Throughput)

| API | 최소 처리량 |
|-----|------------|
| 검색 API | 100 req/sec |
| 상세 조회 | 200 req/sec |
| 사이트맵 | 5 req/sec |

### 에러율 (Error Rate)

- **검색 API**: < 1%
- **상세 조회**: < 1% (404 응답 제외)
- **사이트맵**: < 0.1%

### 리소스 사용량

- **CPU**: 평균 < 70%, 피크 < 90%
- **메모리**: < 512MB (Node.js 프로세스)
- **MySQL 커넥션**: < 20개 동시 사용

---

## Kakao API 쿼터 관리

일상킷은 Kakao Maps API의 주소 검색 기능을 사용하지만, 현재는 직접적인 쿼터 소비가 없습니다.
향후 기능 추가 시 참고할 수 있도록 쿼터 관리 방법을 문서화합니다.

### Kakao API 일일 쿼터

| 서비스 | 무료 할당량 | 초과 시 |
|--------|------------|---------|
| 주소 검색 | 300,000 요청/일 | 유료 전환 필요 |
| 좌표→주소 변환 | 300,000 요청/일 | 유료 전환 필요 |
| 키워드 검색 | 300,000 요청/일 | 유료 전환 필요 |

### 현재 예상 사용량 계산

일상킷은 **데이터 동기화 시**에만 Kakao API를 사용합니다:

**사용 시나리오**:
1. **무인민원발급기 동기화** (`syncKiosk.ts`)
   - 주소 → 좌표 변환 (지오코딩)
   - 예상: 500개 × 1회/일 = 500 요청/일

2. **향후 신규 카테고리 추가 시**
   - 초기 동기화: 1,000~10,000 요청 (1회성)
   - 일일 업데이트: 10~100 요청/일

**총 예상 사용량**: 약 500~1,000 요청/일 (전체 쿼터의 0.3%)

### 쿼터 모니터링 방법

#### 1. Kakao Developers 콘솔

1. [Kakao Developers](https://developers.kakao.com) 로그인
2. 내 애플리케이션 > 일상킷 선택
3. 통계 > API 호출 현황 확인

**주요 지표**:
- 일별 호출 횟수
- 시간대별 분포
- 응답 시간 통계

#### 2. 애플리케이션 로그 모니터링

```typescript
// backend/src/services/geocodingService.ts 예시
async function geocode(address: string) {
  const startTime = Date.now();

  try {
    const response = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${address}`, {
      headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` }
    });

    const duration = Date.now() - startTime;

    // 로그 기록
    console.log(`[Kakao API] 주소 검색: ${duration}ms, quota: ${response.headers.get('x-quota-remaining')}`);

    return response.json();
  } catch (error) {
    console.error('[Kakao API] 에러:', error);
    throw error;
  }
}
```

#### 3. 스크립트로 사용량 추적

```bash
# 일일 동기화 사용량 체크
cd backend
npm run sync:kiosk 2>&1 | grep "Kakao API" | wc -l
```

### 쿼터 초과 시 대응 방안

#### 1. 캐싱 전략

```typescript
// 지오코딩 결과를 DB에 캐싱
interface GeocodingCache {
  address: string;
  latitude: number;
  longitude: number;
  createdAt: Date;
}

// 캐시 확인 → API 호출 → 캐시 저장
async function geocodeWithCache(address: string) {
  const cached = await db.geocodingCache.findUnique({ where: { address } });

  if (cached && isWithin30Days(cached.createdAt)) {
    return cached; // 캐시 히트
  }

  const result = await kakaoGeocode(address);
  await db.geocodingCache.upsert({ where: { address }, data: result });

  return result;
}
```

#### 2. Rate Limiting (내부)

```typescript
// 1초당 최대 10회로 제한
import pLimit from 'p-limit';

const limit = pLimit(10); // 동시 실행 제한

const promises = addresses.map(addr =>
  limit(() => geocode(addr))
);

await Promise.all(promises);
```

#### 3. 배치 처리

```typescript
// 대량 동기화 시 여러 날에 걸쳐 분산
const DAILY_LIMIT = 10000;
const chunks = chunkArray(addresses, DAILY_LIMIT);

for (const [index, chunk] of chunks.entries()) {
  console.log(`배치 ${index + 1}/${chunks.length} 처리 중...`);
  await processChunk(chunk);

  if (index < chunks.length - 1) {
    console.log('다음 배치는 내일 실행됩니다.');
    break; // 다음 날 크론잡이 이어서 실행
  }
}
```

#### 4. 대안 서비스 검토

쿼터가 지속적으로 부족할 경우:
- **네이버 Maps API**: 무료 쿼터 500,000 요청/일
- **VWorld API**: 공공 데이터 무제한
- **Google Maps API**: 유료 (월 $200 크레딧)

### 알림 설정

쿼터가 80% 도달 시 알림:

```typescript
// 동기화 스크립트에 추가
const QUOTA_LIMIT = 300000;
const ALERT_THRESHOLD = 0.8;

async function checkQuota() {
  const todayUsage = await getTodayKakaoApiUsage();

  if (todayUsage > QUOTA_LIMIT * ALERT_THRESHOLD) {
    await sendAlert({
      title: 'Kakao API 쿼터 경고',
      message: `오늘 사용량: ${todayUsage} / ${QUOTA_LIMIT} (${(todayUsage/QUOTA_LIMIT*100).toFixed(1)}%)`,
      level: 'warning'
    });
  }
}
```

---

## 문제 해결

### 1. "서버 연결 실패" 에러

**원인**: 백엔드 서버가 실행되지 않음

**해결**:
```bash
cd backend
npm run dev  # 개발 서버 실행
```

### 2. P95 레이턴시 기준 초과

**원인**:
- DB 인덱스 부족
- 데이터베이스 과부하
- MySQL 커넥션 풀 부족

**해결**:

1. DB 인덱스 확인:
   ```sql
   -- 인덱스 재생성
   ALTER TABLE Toilet ADD INDEX idx_location (latitude, longitude);
   ```

2. MySQL 커넥션 풀 증가:
   ```typescript
   // backend/src/lib/prisma.ts
   const prisma = new PrismaClient({
     datasources: {
       db: {
         url: process.env.DATABASE_URL + '?connection_limit=20'
       }
     }
   });
   ```

3. 쿼리 최적화:
   ```bash
   # 느린 쿼리 로그 활성화
   mysql> SET GLOBAL slow_query_log = 'ON';
   mysql> SET GLOBAL long_query_time = 1;
   ```

### 3. 메모리 부족 에러

**원인**: 사이트맵 생성 시 대량 데이터 로드

**해결**:

1. 페이징 처리:
   ```typescript
   // 한 번에 1000개씩만 로드
   const batchSize = 1000;
   for (let skip = 0; skip < total; skip += batchSize) {
     const batch = await prisma.facility.findMany({
       take: batchSize,
       skip,
     });
     // 처리...
   }
   ```

2. Node.js 메모리 증가:
   ```bash
   NODE_OPTIONS=--max-old-space-size=4096 npm run test:load
   ```

### 4. Rate Limiting 에러 (429)

**원인**: Rate limiter가 활성화됨

**해결**:
```typescript
// backend/src/middlewares/rateLimit.ts
export const searchRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 100, // 테스트 시 제한 완화
});
```

### 5. 동시 접속 수 증가 시 에러

**원인**: OS 파일 디스크립터 제한

**해결** (macOS/Linux):
```bash
# 현재 제한 확인
ulimit -n

# 제한 증가 (임시)
ulimit -n 10000

# 영구 설정 (macOS)
sudo launchctl limit maxfiles 65536 200000
```

---

## 성능 개선 팁

### 1. 데이터베이스 최적화

- **인덱스**: latitude, longitude, category 컬럼
- **커넥션 풀**: 최소 10개 유지
- **쿼리 캐싱**: Redis 도입 검토

### 2. 애플리케이션 최적화

- **Response 압축**: gzip 활성화
  ```typescript
  import compression from 'compression';
  app.use(compression());
  ```

- **정적 리소스 캐싱**: Nginx 활용
  ```nginx
  location /api/sitemap {
    proxy_cache sitemap_cache;
    proxy_cache_valid 200 1h;
  }
  ```

### 3. 모니터링 도구

- **APM**: New Relic, Datadog
- **로그 분석**: ELK Stack
- **DB 모니터링**: Percona Monitoring

---

## 추가 참고사항

### 프로덕션 부하 테스트 체크리스트

- [ ] 사용자 트래픽이 적은 시간대 선택 (새벽 2-4시)
- [ ] 동시 접속 수를 점진적으로 증가 (50 → 100 → 200)
- [ ] 모니터링 대시보드 준비 (CPU, 메모리, DB)
- [ ] 롤백 계획 수립
- [ ] 팀원에게 사전 공지

### 자동화된 부하 테스트 (CI/CD)

```yaml
# .github/workflows/load-test.yml
name: Load Test

on:
  schedule:
    - cron: '0 2 * * 0'  # 매주 일요일 새벽 2시

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
      - name: Run Load Test
        run: |
          cd backend
          npm install
          npm run test:load -- --duration 60
```

---

**마지막 업데이트**: 2026-02-12
**작성자**: Backend Team
**버전**: 1.0.0
