import { describe, it, expect, vi, beforeEach } from 'vitest';
import { repairReportedToiletCoordinates } from '../../src/scripts/repairReportedToiletCoordinates.js';

function makeDb(matched: number, updated = matched) {
  return {
    toilet: {
      count: vi.fn().mockResolvedValue(matched),
      updateMany: vi.fn().mockResolvedValue({ count: updated }),
    },
  };
}

describe('repairReportedToiletCoordinates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('기본 dry-run은 매칭되어도 쓰지 않는다', async () => {
    const db = makeDb(1);

    const result = await repairReportedToiletCoordinates(db);

    expect(result).toMatchObject({ mode: 'dry-run', matched: 1, updated: 0 });
    expect(db.toilet.updateMany).not.toHaveBeenCalled();
  });

  it('--apply에서 ID·주소·기존 좌표가 모두 맞을 때만 lat/lng를 null 처리한다', async () => {
    const db = makeDb(1);

    const result = await repairReportedToiletCoordinates(db, { apply: true });

    expect(result).toMatchObject({ mode: 'apply', matched: 1, updated: 1 });
    expect(db.toilet.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'toilet-5423af32f2a034b7',
        OR: [
          { address: { contains: '영등포구 양산로 지하21' } },
          { roadAddress: { contains: '영등포구 양산로 지하21' } },
        ],
        lat: 37.509109,
        lng: 127.049088,
      },
      data: { lat: null, lng: null },
    });
  });

  it('--apply여도 guard 매칭이 1건이 아니면 쓰지 않는다', async () => {
    const db = makeDb(0);

    const result = await repairReportedToiletCoordinates(db, { apply: true });

    expect(result).toMatchObject({ mode: 'apply', matched: 0, updated: 0 });
    expect(db.toilet.updateMany).not.toHaveBeenCalled();
  });
});
