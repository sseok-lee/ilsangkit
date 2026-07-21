// @TASK Task A3 — Region sync 정규화 + 옛코드 재생성 가드
// @SPEC .superpowers/sdd/task-A3-brief.md

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import prisma from '../../src/lib/prisma.js';
import { syncRegionData } from '../../src/scripts/syncRegion.js';
import { JNGJ_CITY } from '../../src/lib/normalizeRegionName.js';

/**
 * 이 테스트는 완전 hermetic한 단위 테스트다(실 DB·실 네트워크·실 API 키 불필요).
 *
 * - prisma를 통째로 mock한다 → 실제 DB 연결/상태에 의존하지 않는다. 기존 통합
 *   테스트는 CI(빈 DB)와 로컬(채워진 DB)에서 결과가 갈려 flaky했다(신규 create 경로가
 *   CI에서 결정적으로 조회되지 않아 `expect(newRow).not.toBeNull()` 실패).
 * - syncRegion.ts는 geocodingService.geocode()로 실제 Kakao API를 호출하므로 고정
 *   좌표로 mock한다(CI엔 KAKAO_REST_API_KEY 부재).
 * - fetchRegionsFromApi()는 OPENAPI_SERVICE_KEY가 없으면 throw→로컬 fallback으로
 *   빠지므로(테스트 대상 신코드 12010이 사라짐), 테스트 내에서 더미 키를 세팅해
 *   API(fetch mock) 경로가 결정적으로 타지도록 한다. StanReginCd 응답은 global.fetch
 *   mock으로 공급한다.
 *
 * 검증 방식: 실 DB 조회(findFirst→not.toBeNull) 대신 prisma.region.create/update의
 * mock 호출 인자를 단언한다.
 */

// prisma default export를 통째로 mock (실 DB 의존 제거 → DATABASE_URL 불필요)
vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    region: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

// geocode()를 고정 좌표로 mock (환경·키와 무관하게 결정적 동작)
vi.mock('../../src/services/geocodingService.js', () => ({
  geocode: vi.fn(async () => ({ lat: 35.1468, lng: 126.9226 })), // 광주 동구 근방 고정 좌표
}));

/**
 * 2026-07-01 전남광주통합특별시 출범 대응(A3): syncRegion(법정동코드 API)이
 * city를 전남광주통합특별시로 정규화 저장하고, 옛 코드(bjdCode 29/46) Region 행을
 * 새로 만들거나 기존 정상 행을 옛코드로 덮어쓰지 않도록 가드한다.
 *
 * 실제 운영 API는 이미 12(신코드)만 반환하는 것으로 확인됐지만("자연 소멸"), 전환기
 * 잔존/오염 로우가 섞여 들어오는 최악의 경우에도 옛코드 행이 upsert되지 않아야 한다는
 * 방어 가드를 검증한다. 가드가 없으면 city+district unique 매칭으로 인해 신코드(12) 로우가
 * 옛코드(29) 로우에 의해 덮어써지는 회귀가 발생한다.
 */
describe('syncRegion — JNGJ 정규화 + 옛코드 재생성 가드 (Task A3)', () => {
  // 통째로 mock된 prisma.region 접근용 타입 캐스트
  const region = prisma.region as unknown as {
    findFirst: Mock;
    create: Mock;
    update: Mock;
    delete: Mock;
    deleteMany: Mock;
    count: Mock;
  };

  const originalFetch = global.fetch;
  const originalServiceKey = process.env.OPENAPI_SERVICE_KEY;

  beforeEach(() => {
    vi.clearAllMocks();

    // 빈 DB 시뮬레이션: 기존 행이 없어 create(신규) 경로가 강제된다
    region.findFirst.mockResolvedValue(null);
    region.count.mockResolvedValue(0);
    region.create.mockResolvedValue({} as never);
    region.update.mockResolvedValue({} as never);
    region.delete.mockResolvedValue({} as never);
    region.deleteMany.mockResolvedValue({ count: 0 } as never);

    // API(fetch mock) 경로를 결정적으로 타도록 더미 서비스 키 세팅
    process.env.OPENAPI_SERVICE_KEY = 'test-service-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalServiceKey === undefined) {
      delete process.env.OPENAPI_SERVICE_KEY;
    } else {
      process.env.OPENAPI_SERVICE_KEY = originalServiceKey;
    }
  });

  it('법정동 API가 신코드(12, JNGJ명) 로우와 전환기 잔존 옛코드(29, 구명) 로우를 함께 줘도 옛코드는 upsert 0건이고 city는 JNGJ로 저장된다', async () => {
    const mockApiResponse = {
      StanReginCd: [
        {
          head: [
            { totalCount: 2 },
            { numOfRows: '1000', pageNo: '1', type: 'json' },
            { RESULT: { resultCode: 'INFO-0', resultMsg: 'NORMAL SERVICE' } },
          ],
        },
        {
          row: [
            {
              region_cd: '1201000000',
              sido_cd: '12',
              sgg_cd: '010',
              umd_cd: '000',
              ri_cd: '00',
              locatjumin_cd: '1201000000',
              locatjijuk_cd: '1201000000',
              locatadd_nm: '전남광주통합특별시 동구',
              locat_order: 1,
              locat_rm: '',
              locathigh_cd: '',
              locallow_nm: '동구',
              adpt_de: '20260701',
            },
            {
              // 전환기 잔존/오염 로우 시나리오: 이미 신코드로 통합된 지역이 옛 시도명+옛코드로
              // 다시 섞여 들어오는 최악의 경우를 가정 (실운영 API는 이미 12만 반환하지만 방어 가드 대상)
              region_cd: '2901000000',
              sido_cd: '29',
              sgg_cd: '010',
              umd_cd: '000',
              ri_cd: '00',
              locatjumin_cd: '2901000000',
              locatjijuk_cd: '2901000000',
              locatadd_nm: '광주광역시 동구',
              locat_order: 1,
              locat_rm: '',
              locathigh_cd: '',
              locallow_nm: '동구',
              adpt_de: '19880101',
            },
          ],
        },
      ],
    };

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('StanReginCd')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockApiResponse,
        } as Response;
      }
      // StanReginCd 이외 호출(사용되지 않을 것으로 예상 — geocode()는 위에서 mock됨)
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({}),
      } as Response;
    }) as unknown as typeof fetch;

    const result = await syncRegionData({});

    expect(result.status).toBe('success');

    // 저장(create/update)된 data 인자를 모두 수집
    const savedData = [
      ...region.create.mock.calls.map((c) => (c[0] as { data?: Record<string, unknown> })?.data),
      ...region.update.mock.calls.map((c) => (c[0] as { data?: Record<string, unknown> })?.data),
    ].filter((d): d is Record<string, unknown> => Boolean(d));

    // (1) city가 전남광주통합특별시로 정규화되어 신코드(12010) 행이 저장됨
    expect(region.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bjdCode: '12010',
          city: JNGJ_CITY,
          district: '동구',
        }),
      })
    );
    expect(savedData.some((d) => d.bjdCode === '12010')).toBe(true);

    // (2) 옛코드(29010) 자체는 어떤 create/update에도 담기지 않음(가드로 스킵)
    expect(savedData.some((d) => d.bjdCode === '29010')).toBe(false);
  });
});
