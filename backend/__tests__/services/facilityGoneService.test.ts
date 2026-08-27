// 영구 제거된 시설 URL 조회 (410 Gone 판정)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// findUnique 를 교체 가능한 슬롯으로 둔다. 에러 경로 테스트에서는 vi.fn() 이 아닌
// 평범한 함수로 갈아끼운다 — vitest 4 는 vi.fn() 안에서 발생한 에러를 코드가 catch 해도
// 테스트 실패로 별도 보고하므로, 그대로는 fail-open 을 검증할 수 없다.
const { mockPrisma, mockFindUnique } = vi.hoisted(() => {
  const fn = vi.fn();
  return { mockPrisma: { facilityGone: { findUnique: fn as unknown } }, mockFindUnique: fn };
});

vi.mock('../../src/lib/prisma.js', () => ({ default: mockPrisma }));

import { isFacilityGone } from '../../src/services/facilityGoneService.js';

describe('isFacilityGone', () => {
  beforeEach(() => {
    mockFindUnique.mockReset();
    mockPrisma.facilityGone.findUnique = mockFindUnique;
  });

  it('FacilityGone 에 있으면 true', async () => {
    mockFindUnique.mockResolvedValue({ id: 'childcare-11110000009' });
    await expect(isFacilityGone('childcare-11110000009')).resolves.toBe(true);
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 'childcare-11110000009' },
      select: { id: true },
    });
  });

  it('없으면 false', async () => {
    mockFindUnique.mockResolvedValue(null);
    await expect(isFacilityGone('childcare-99999999999')).resolves.toBe(false);
  });

  it('조회가 실패하면 false — fail-open (404 로 떨어뜨려 500 을 막는다)', async () => {
    let called = false;
    mockPrisma.facilityGone.findUnique = () => {
      called = true;
      throw new Error('Table does not exist');
    };
    const result = await isFacilityGone('childcare-11110000009');
    expect(called).toBe(true);
    expect(result).toBe(false);
  });

  it('빈 id 는 쿼리 없이 false — 부재 경로에서만 호출되므로 방어한다', async () => {
    await expect(isFacilityGone('')).resolves.toBe(false);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
