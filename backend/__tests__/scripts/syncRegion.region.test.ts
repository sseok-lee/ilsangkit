// @TASK Task A3 — Region sync 정규화 + 옛코드 재생성 가드
// @SPEC .superpowers/sdd/task-A3-brief.md

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import prisma from '../../src/lib/prisma.js';
import { JNGJ_CITY } from '../../src/lib/normalizeRegionName.js';

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
  const TEST_BJD_CODES = ['12010', '29010'];
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await prisma.region.deleteMany({ where: { bjdCode: { in: TEST_BJD_CODES } } });
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await prisma.region.deleteMany({ where: { bjdCode: { in: TEST_BJD_CODES } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
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

    // 동기화 전 옛코드(29/46) 행 개수 스냅샷(운영/개발 DB에 이미 존재할 수 있는 미정리 옛코드
    // 행은 Phase B 범위 — 이 테스트는 "이 sync 실행이 새로 upsert하지 않는다"만 검증한다)
    const oldCodeCountBefore = await prisma.region.count({
      where: { OR: [{ bjdCode: { startsWith: '29' } }, { bjdCode: { startsWith: '46' } }] },
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('StanReginCd')) {
        return {
          ok: true,
          status: 200,
          json: async () => mockApiResponse,
        } as Response;
      }
      // Kakao 지오코딩 등 그 외 호출은 실패 응답으로 처리(geocode()는 null-safe)
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({}),
      } as Response;
    }) as unknown as typeof fetch;

    const { syncRegionData } = await import('../../src/scripts/syncRegion.js');

    const result = await syncRegionData({});

    expect(result.status).toBe('success');

    // (1) city가 전남광주통합특별시로 저장됨 (신코드 12 행)
    const newRow = await prisma.region.findFirst({ where: { bjdCode: '12010' } });
    expect(newRow).not.toBeNull();
    expect(newRow?.city).toBe(JNGJ_CITY);
    expect(newRow?.district).toBe('동구');

    // (2) 옛코드(29) 자체가 upsert되지 않음 (신코드 행이 옛코드로 덮어써지지 않음)
    const oldRow = await prisma.region.findFirst({ where: { bjdCode: '29010' } });
    expect(oldRow).toBeNull();

    // (3) 이 sync 실행이 옛코드 접두(29/46) Region 행을 새로 upsert하지 않음(개수 불변)
    const oldCodeCountAfter = await prisma.region.count({
      where: { OR: [{ bjdCode: { startsWith: '29' } }, { bjdCode: { startsWith: '46' } }] },
    });
    expect(oldCodeCountAfter).toBe(oldCodeCountBefore);
  });
});
