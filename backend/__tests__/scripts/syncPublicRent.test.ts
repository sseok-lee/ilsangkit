import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    publicRentalComplex: { upsert: vi.fn(), findUnique: vi.fn() },
    region: { findMany: vi.fn() },
  },
}));

global.fetch = vi.fn();

import {
  transformMyhomeItem,
  fetchWithRetry,
  type MyhomeRentalItem,
} from '../../src/scripts/syncPublicRent.js';

function makeItem(overrides: Partial<MyhomeRentalItem> = {}): MyhomeRentalItem {
  return {
    hsmpSn: 12345678,
    insttNm: 'LH서울',
    brtcCode: '11',
    brtcNm: '서울특별시',
    signguCode: '530',
    signguNm: '구로구',
    hsmpNm: '서울특별시 구로구',
    rnAdres: '서울특별시 구로구 디지털로 100',
    hshldCo: 2,
    suplyTyNm: '매입임대',
    houseTyNm: '아파트',
    suplyPrvuseAr: 45.5,
    bassRentGtn: 5000000,
    bassMtRntchrg: 150000,
    ...overrides,
  };
}

describe('transformMyhomeItem', () => {
  it('기본 변환', () => {
    const result = transformMyhomeItem(makeItem());
    expect(result.complexCode).toBe('12345678');
    expect(result.sourceId).toBe('lh-12345678');
    expect(result.city).toBe('서울특별시');
    expect(result.district).toBe('구로구');
    expect(result.rentalType).toBe('매입임대');
    expect(result.houseType).toBe('아파트');
    expect(result.householdCount).toBe(2);
    expect(result.exclusiveArea).toBeCloseTo(45.5);
    expect(result.depositAmount).toBe(BigInt(5000000));
    expect(result.monthlyRent).toBe(150000);
    expect(result.landlordAgency).toBe('LH');
  });

  it('도로명주소를 complexName으로 사용', () => {
    const result = transformMyhomeItem(makeItem({ rnAdres: '서울특별시 구로구 디지털로 100' }));
    expect(result.complexName).toBe('서울특별시 구로구 디지털로 100');
  });

  it('rnAdres 없으면 hsmpNm 사용', () => {
    const result = transformMyhomeItem(makeItem({ rnAdres: '' }));
    expect(result.complexName).toBe('서울특별시 구로구');
  });

  it('빈 객체 {} 필드 — BigInt 변환 안전 처리', () => {
    const item = makeItem({
      bassRentGtn: {} as unknown as number,
      bassMtRntchrg: {} as unknown as number,
      suplyPrvuseAr: {} as unknown as number,
      hshldCo: {} as unknown as number,
    });
    const result = transformMyhomeItem(item);
    expect(result.depositAmount).toBeNull();
    expect(result.monthlyRent).toBeNull();
    expect(result.exclusiveArea).toBeNull();
    expect(result.householdCount).toBeNull();
  });

  it('보증금 0원 처리 — BigInt(0)으로 저장', () => {
    const result = transformMyhomeItem(makeItem({ bassRentGtn: 0 }));
    expect(result.depositAmount).toBe(BigInt(0));
  });

  it('houseTyNm 없으면 null', () => {
    const result = transformMyhomeItem(makeItem({ houseTyNm: undefined }));
    expect(result.houseType).toBeNull();
  });

  it('sourceId 형식 검증', () => {
    const result = transformMyhomeItem(makeItem({ hsmpSn: 99999999 }));
    expect(result.sourceId).toBe('lh-99999999');
    expect(result.complexCode).toBe('99999999');
  });
});

describe('fetchWithRetry', () => {
  const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('200 응답은 즉시 반환 (retry 없음)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    const res = await fetchWithRetry('https://example.test');
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('일시적 500 → 재시도해 200 으로 복구', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    const res = await fetchWithRetry('https://example.test');
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('연속 5xx 가 retry 한도(2회) 넘으면 마지막 에러 throw', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('boom1', { status: 500 }))
      .mockResolvedValueOnce(new Response('boom2', { status: 502 }))
      .mockResolvedValueOnce(new Response('boom3', { status: 503 }));
    await expect(fetchWithRetry('https://example.test')).rejects.toThrow(/HTTP 503/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('4xx 는 retry 없이 즉시 throw (영구 오류)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not found', { status: 404 }));
    await expect(fetchWithRetry('https://example.test')).rejects.toThrow(/HTTP 404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('네트워크 에러도 retry 대상', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }));
    const res = await fetchWithRetry('https://example.test');
    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
