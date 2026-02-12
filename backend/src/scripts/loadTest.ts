#!/usr/bin/env tsx
/**
 * 부하 테스트 스크립트
 *
 * 주요 API 엔드포인트에 대한 성능 테스트 수행
 * - POST /api/facilities/search (동시 검색 부하)
 * - GET /api/sitemap/facilities/:category (사이트맵 생성 부하)
 * - GET /api/facilities/:category/:id (상세 조회 부하)
 *
 * 사용법:
 *   npm run test:load                           # 전체 시나리오 실행
 *   npm run test:load -- --scenario search      # 특정 시나리오만 실행
 *   npm run test:load -- --connections 200      # 동시 접속 수 변경
 */

interface LoadTestConfig {
  baseUrl: string;
  connections: number; // 동시 접속 수
  duration: number; // 테스트 지속 시간 (초)
  warmupDuration: number; // 워밍업 시간 (초)
}

interface TestResult {
  scenario: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  duration: number;
  throughput: number; // req/sec
  latencies: {
    min: number;
    max: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
}

/**
 * 레이턴시 통계 계산
 */
function calculateLatencies(latencies: number[]) {
  const sorted = latencies.sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);

  return {
    min: sorted[0] || 0,
    max: sorted[sorted.length - 1] || 0,
    avg: sum / sorted.length || 0,
    p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
    p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
    p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
  };
}

/**
 * 워밍업 요청 (캐시 준비)
 */
async function warmup(baseUrl: string, duration: number) {
  console.log(`\n🔥 워밍업 시작 (${duration}초)...`);
  const endTime = Date.now() + duration * 1000;

  while (Date.now() < endTime) {
    try {
      await fetch(`${baseUrl}/api/facilities/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 1000,
        }),
      });
    } catch {
      // 워밍업 중 에러는 무시
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('✅ 워밍업 완료\n');
}

/**
 * 시나리오 1: 검색 API 부하 테스트
 */
async function testSearchLoad(config: LoadTestConfig): Promise<TestResult> {
  console.log(`📊 시나리오 1: 검색 API 부하 테스트 (동시 접속: ${config.connections})`);

  const latencies: number[] = [];
  let successCount = 0;
  let failCount = 0;

  const startTime = Date.now();
  const endTime = startTime + config.duration * 1000;

  // 테스트용 좌표 샘플 (서울 주요 지역)
  const testLocations = [
    { latitude: 37.5665, longitude: 126.9780 }, // 서울시청
    { latitude: 37.5172, longitude: 127.0473 }, // 강남역
    { latitude: 37.5518, longitude: 126.9918 }, // 동대문
    { latitude: 37.4959, longitude: 127.0664 }, // 잠실
    { latitude: 37.5794, longitude: 126.9770 }, // 광화문
  ];

  const workers: Promise<void>[] = [];

  for (let i = 0; i < config.connections; i++) {
    workers.push(
      (async () => {
        while (Date.now() < endTime) {
          const location = testLocations[Math.floor(Math.random() * testLocations.length)];
          const reqStart = Date.now();

          try {
            const response = await fetch(`${config.baseUrl}/api/facilities/search`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...location,
                radius: 1000,
                page: 1,
                limit: 20,
              }),
            });

            const latency = Date.now() - reqStart;
            latencies.push(latency);

            if (response.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch {
            failCount++;
          }

          // 작은 딜레이로 API 과부하 방지
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      })()
    );
  }

  await Promise.all(workers);

  const duration = Date.now() - startTime;
  const totalRequests = successCount + failCount;

  return {
    scenario: 'Search API',
    totalRequests,
    successfulRequests: successCount,
    failedRequests: failCount,
    duration,
    throughput: totalRequests / (duration / 1000),
    latencies: calculateLatencies(latencies),
  };
}

/**
 * 시나리오 2: 사이트맵 생성 부하 테스트
 */
async function testSitemapLoad(config: LoadTestConfig): Promise<TestResult> {
  console.log(`📊 시나리오 2: 사이트맵 부하 테스트 (동시 접속: ${Math.min(config.connections, 20)})`);

  const categories = ['toilet', 'wifi', 'clothes', 'kiosk', 'parking', 'aed', 'library'];
  const latencies: number[] = [];
  let successCount = 0;
  let failCount = 0;

  const startTime = Date.now();
  const endTime = startTime + config.duration * 1000;

  // 사이트맵은 heavy operation이므로 동시 접속 수 제한
  const workers: Promise<void>[] = [];
  const limitedConnections = Math.min(config.connections, 20);

  for (let i = 0; i < limitedConnections; i++) {
    workers.push(
      (async () => {
        while (Date.now() < endTime) {
          const category = categories[Math.floor(Math.random() * categories.length)];
          const reqStart = Date.now();

          try {
            const response = await fetch(`${config.baseUrl}/api/sitemap/facilities/${category}`);

            const latency = Date.now() - reqStart;
            latencies.push(latency);

            if (response.ok) {
              successCount++;
            } else {
              failCount++;
            }
          } catch {
            failCount++;
          }

          // 사이트맵은 무거우므로 더 긴 딜레이
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      })()
    );
  }

  await Promise.all(workers);

  const duration = Date.now() - startTime;
  const totalRequests = successCount + failCount;

  return {
    scenario: 'Sitemap API',
    totalRequests,
    successfulRequests: successCount,
    failedRequests: failCount,
    duration,
    throughput: totalRequests / (duration / 1000),
    latencies: calculateLatencies(latencies),
  };
}

/**
 * 시나리오 3: 상세 조회 부하 테스트
 */
async function testDetailLoad(config: LoadTestConfig): Promise<TestResult> {
  console.log(`📊 시나리오 3: 상세 조회 부하 테스트 (동시 접속: ${config.connections})`);

  const categories = ['toilet', 'wifi', 'clothes', 'kiosk', 'parking', 'aed', 'library'];
  const latencies: number[] = [];
  let successCount = 0;
  let failCount = 0;

  const startTime = Date.now();
  const endTime = startTime + config.duration * 1000;

  const workers: Promise<void>[] = [];

  for (let i = 0; i < config.connections; i++) {
    workers.push(
      (async () => {
        while (Date.now() < endTime) {
          const category = categories[Math.floor(Math.random() * categories.length)];
          const id = Math.floor(Math.random() * 1000) + 1; // 임의의 ID
          const reqStart = Date.now();

          try {
            const response = await fetch(`${config.baseUrl}/api/facilities/${category}/${id}`);

            const latency = Date.now() - reqStart;
            latencies.push(latency);

            if (response.ok || response.status === 404) {
              // 404도 정상 응답으로 간주 (데이터가 없을 수 있음)
              successCount++;
            } else {
              failCount++;
            }
          } catch {
            failCount++;
          }

          await new Promise(resolve => setTimeout(resolve, 10));
        }
      })()
    );
  }

  await Promise.all(workers);

  const duration = Date.now() - startTime;
  const totalRequests = successCount + failCount;

  return {
    scenario: 'Detail API',
    totalRequests,
    successfulRequests: successCount,
    failedRequests: failCount,
    duration,
    throughput: totalRequests / (duration / 1000),
    latencies: calculateLatencies(latencies),
  };
}

/**
 * 결과 출력
 */
function printResults(results: TestResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('📈 부하 테스트 결과');
  console.log('='.repeat(80));

  for (const result of results) {
    console.log(`\n[${result.scenario}]`);
    console.log(`  총 요청 수: ${result.totalRequests}`);
    console.log(`  성공: ${result.successfulRequests} (${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%)`);
    console.log(`  실패: ${result.failedRequests} (${((result.failedRequests / result.totalRequests) * 100).toFixed(2)}%)`);
    console.log(`  처리량: ${result.throughput.toFixed(2)} req/sec`);
    console.log(`  레이턴시:`);
    console.log(`    - Min: ${result.latencies.min.toFixed(2)}ms`);
    console.log(`    - Avg: ${result.latencies.avg.toFixed(2)}ms`);
    console.log(`    - P50: ${result.latencies.p50.toFixed(2)}ms`);
    console.log(`    - P95: ${result.latencies.p95.toFixed(2)}ms`);
    console.log(`    - P99: ${result.latencies.p99.toFixed(2)}ms`);
    console.log(`    - Max: ${result.latencies.max.toFixed(2)}ms`);

    // 성능 기준 체크
    if (result.scenario === 'Search API' && result.latencies.p95 < 500) {
      console.log(`  ✅ P95 레이턴시 기준 통과 (< 500ms)`);
    } else if (result.scenario === 'Search API') {
      console.log(`  ⚠️  P95 레이턴시 기준 초과 (${result.latencies.p95.toFixed(2)}ms > 500ms)`);
    }

    if (result.scenario === 'Detail API' && result.latencies.p95 < 200) {
      console.log(`  ✅ P95 레이턴시 기준 통과 (< 200ms)`);
    } else if (result.scenario === 'Detail API') {
      console.log(`  ⚠️  P95 레이턴시 기준 초과 (${result.latencies.p95.toFixed(2)}ms > 200ms)`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

/**
 * 메인 함수
 */
async function main() {
  const args = process.argv.slice(2);

  // 설정
  const config: LoadTestConfig = {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:8000',
    connections: 100, // 기본 동시 접속 수
    duration: 10, // 기본 테스트 시간 (초)
    warmupDuration: 3, // 워밍업 시간 (초)
  };

  // 커맨드라인 인자 파싱
  const connectionsIndex = args.indexOf('--connections');
  if (connectionsIndex !== -1 && args[connectionsIndex + 1]) {
    config.connections = parseInt(args[connectionsIndex + 1], 10);
  }

  const durationIndex = args.indexOf('--duration');
  if (durationIndex !== -1 && args[durationIndex + 1]) {
    config.duration = parseInt(args[durationIndex + 1], 10);
  }

  const scenarioIndex = args.indexOf('--scenario');
  const targetScenario = scenarioIndex !== -1 ? args[scenarioIndex + 1] : null;

  console.log('='.repeat(80));
  console.log('🚀 일상킷 API 부하 테스트');
  console.log('='.repeat(80));
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`동시 접속 수: ${config.connections}`);
  console.log(`테스트 시간: ${config.duration}초`);
  console.log('='.repeat(80));

  // 서버 상태 체크
  try {
    const response = await fetch(`${config.baseUrl}/api/meta`);
    if (!response.ok) {
      throw new Error('서버가 응답하지 않습니다');
    }
    console.log('✅ 서버 연결 확인\n');
  } catch (error) {
    console.error('❌ 서버 연결 실패:', error);
    console.error('서버가 실행 중인지 확인하세요: npm run dev');
    process.exit(1);
  }

  // 워밍업
  await warmup(config.baseUrl, config.warmupDuration);

  // 테스트 실행
  const results: TestResult[] = [];

  if (!targetScenario || targetScenario === 'search') {
    const result = await testSearchLoad(config);
    results.push(result);
    console.log('✅ 검색 API 테스트 완료\n');
  }

  if (!targetScenario || targetScenario === 'sitemap') {
    const result = await testSitemapLoad(config);
    results.push(result);
    console.log('✅ 사이트맵 API 테스트 완료\n');
  }

  if (!targetScenario || targetScenario === 'detail') {
    const result = await testDetailLoad(config);
    results.push(result);
    console.log('✅ 상세 조회 API 테스트 완료\n');
  }

  // 결과 출력
  printResults(results);

  // 성능 기준 체크
  const searchResult = results.find(r => r.scenario === 'Search API');
  if (searchResult && searchResult.latencies.p95 >= 500) {
    console.log('\n⚠️  경고: 검색 API P95 레이턴시가 기준(500ms)을 초과했습니다.');
    process.exit(1);
  }

  const detailResult = results.find(r => r.scenario === 'Detail API');
  if (detailResult && detailResult.latencies.p95 >= 200) {
    console.log('\n⚠️  경고: 상세 조회 API P95 레이턴시가 기준(200ms)을 초과했습니다.');
    process.exit(1);
  }

  console.log('\n✅ 모든 성능 기준 통과!');
}

// 스크립트 실행
main().catch(error => {
  console.error('부하 테스트 중 오류 발생:', error);
  process.exit(1);
});
