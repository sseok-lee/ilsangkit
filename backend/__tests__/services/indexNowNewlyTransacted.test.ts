// 신규 거래 건물만 IndexNow 로 제출하는지 검증 (TDD)
//
// 배경: 부동산 sync 는 매일 최근 2개월 거래내역을 재수집한다(워크플로 --from/--to).
// 거래는 append-only 인데 upsert 가 같은 행을 다시 쓰면서 syncedAt 을 갱신하므로,
// syncedAt 기준으로 제출 대상을 뽑으면 "내용이 안 바뀐 건물"까지 매일 제출된다.
// 2026-08-27 프로덕션 실측: 제출 76,832/일 vs 실제 신규 7,564/일 (10.2배 과잉).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitNewlyTransactedBuildings } from '../../src/services/indexNowService.js';

interface BuildingRow {
  buildingName: string;
  city: string;
  district: string;
}

function makeDelegate(rows: BuildingRow[]) {
  const findMany = vi.fn().mockResolvedValue(rows);
  return { delegate: { findMany }, findMany };
}

const SINCE = new Date('2026-08-27T00:00:00.000Z');

describe('submitNewlyTransactedBuildings', () => {
  const originalKey = process.env.INDEXNOW_KEY;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.INDEXNOW_KEY = 'test-key';
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.INDEXNOW_KEY;
    else process.env.INDEXNOW_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it('where 에 createdAt 과 syncedAt 을 함께 걸어 신규 거래행만 고른다', async () => {
    const { delegate, findMany } = makeDelegate([]);

    await submitNewlyTransactedBuildings(delegate, 'apt-sale', 'aptSale', SINCE);

    expect(findMany).toHaveBeenCalledTimes(1);
    const args = findMany.mock.calls[0][0];

    // createdAt: 재수집(syncedAt 갱신)만 된 건물을 걸러내는 핵심 조건
    expect(args.where.createdAt).toEqual({ gte: SINCE });
    // syncedAt: 인덱스가 이 컬럼에만 있다. 신규 행은 두 값이 동시에 박히므로
    // createdAt>=X ⟹ syncedAt>=X 이고, AND 는 결과를 바꾸지 않으면서 range scan 을 얻는다.
    expect(args.where.syncedAt).toEqual({ gte: SINCE });
  });

  it('건물 단위로 중복을 제거한다 (distinct)', async () => {
    const { delegate, findMany } = makeDelegate([]);

    await submitNewlyTransactedBuildings(delegate, 'apt-sale', 'aptSale', SINCE);

    const args = findMany.mock.calls[0][0];
    expect(args.distinct).toEqual(['buildingName', 'city', 'district']);
    expect(args.select).toEqual({ buildingName: true, city: true, district: true });
  });

  it('신규 거래가 생긴 건물의 상세페이지 URL 을 제출한다', async () => {
    const { delegate } = makeDelegate([
      { buildingName: '은마', city: '서울특별시', district: '강남구' },
    ]);

    const result = await submitNewlyTransactedBuildings(delegate, 'apt-sale', 'aptSale', SINCE);

    expect(result.submitted).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.urlList).toHaveLength(1);
    expect(decodeURIComponent(body.urlList[0])).toBe(
      'https://ilsangkit.co.kr/real-estate/apt-sale/seoul/gangnam/은마',
    );
  });

  it('지번 패턴 buildingName 은 제출하지 않는다', async () => {
    const { delegate } = makeDelegate([
      { buildingName: '123-4', city: '서울특별시', district: '강남구' },
    ]);

    const result = await submitNewlyTransactedBuildings(delegate, 'villa-sale', 'villaSale', SINCE);

    expect(result.submitted).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('대상이 없으면 제출 요청을 보내지 않는다', async () => {
    const { delegate } = makeDelegate([]);

    const result = await submitNewlyTransactedBuildings(delegate, 'apt-rent', 'aptRent', SINCE);

    expect(result).toEqual({ submitted: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('realEstateType 이 URL 경로에 반영된다', async () => {
    const { delegate } = makeDelegate([
      { buildingName: '그린빌라', city: '부산광역시', district: '동래구' },
    ]);

    await submitNewlyTransactedBuildings(delegate, 'villa-rent', 'villaRent', SINCE);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(decodeURIComponent(body.urlList[0])).toContain('/real-estate/villa-rent/busan/dongnae/');
  });
});
