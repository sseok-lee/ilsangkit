import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    lhAnnouncement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
  prisma: {
    lhAnnouncement: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import prisma from '../../src/lib/prisma.js';
import {
  getLhAnnouncementList,
  getLhAnnouncementDetail,
  serializeLhRow,
} from '../../src/services/lhAnnouncementService.js';
import { NotFoundError } from '../../src/lib/errors.js';

const mocked = prisma as unknown as {
  lhAnnouncement: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

class FakeDecimal {
  value: number;
  constructor(v: number) { this.value = v; }
  valueOf() { return this.value; }
  toNumber() { return this.value; }
}
Object.defineProperty(FakeDecimal, 'name', { value: 'Decimal' });

describe('serializeLhRow', () => {
  it('converts BigInt to Number recursively', () => {
    const row = {
      id: 1,
      panNm: '경기 부천 임대',
      supplies: [
        { id: 10, lsGmy: 80000000n, mmRfe: 200000, rsdnDdoAr: new FakeDecimal(74.94) },
      ],
      attachments: [{ id: 99, ahflUrl: 'https://x' }],
    };
    const out = serializeLhRow(row);
    expect(out.supplies[0].lsGmy).toBe(80000000);
    expect(out.supplies[0].rsdnDdoAr).toBe(74.94);
    expect(out.attachments[0].ahflUrl).toBe('https://x');
  });

  it('returns Date instances unchanged', () => {
    const d = new Date('2026-04-25T00:00:00Z');
    expect(serializeLhRow(d)).toBe(d);
  });
});

describe('getLhAnnouncementList', () => {
  it('returns paginated rows with default ordering by panSs+clsgDt', async () => {
    mocked.lhAnnouncement.findMany.mockResolvedValue([
      { id: 1, panNm: '공고A', panSs: '공고중', clsgDt: new Date('2026-05-10') },
    ]);
    mocked.lhAnnouncement.count.mockResolvedValue(1);

    const result = await getLhAnnouncementList({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    const call = mocked.lhAnnouncement.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual([{ panSs: 'asc' }, { clsgDt: 'asc' }]);
    expect(result.pagination.total).toBe(1);
  });

  it('applies uppAisTpCd filter', async () => {
    mocked.lhAnnouncement.findMany.mockResolvedValue([]);
    mocked.lhAnnouncement.count.mockResolvedValue(0);

    await getLhAnnouncementList({ page: 1, limit: 20, uppAisTpCd: '06' });
    const call = mocked.lhAnnouncement.findMany.mock.calls[0][0];
    expect(call.where.uppAisTpCd).toBe('06');
  });

  it('applies cnpNm contains filter', async () => {
    mocked.lhAnnouncement.findMany.mockResolvedValue([]);
    mocked.lhAnnouncement.count.mockResolvedValue(0);

    await getLhAnnouncementList({ page: 1, limit: 20, cnpNm: '경기' });
    const call = mocked.lhAnnouncement.findMany.mock.calls[0][0];
    expect(call.where.cnpNm).toEqual({ contains: '경기' });
  });

  it('applies panSs status filter', async () => {
    mocked.lhAnnouncement.findMany.mockResolvedValue([]);
    mocked.lhAnnouncement.count.mockResolvedValue(0);

    await getLhAnnouncementList({ page: 1, limit: 20, panSs: '공고중' });
    const call = mocked.lhAnnouncement.findMany.mock.calls[0][0];
    expect(call.where.panSs).toBe('공고중');
  });

  it('paginates correctly', async () => {
    mocked.lhAnnouncement.findMany.mockResolvedValue([]);
    mocked.lhAnnouncement.count.mockResolvedValue(45);

    const result = await getLhAnnouncementList({ page: 2, limit: 20 });
    const call = mocked.lhAnnouncement.findMany.mock.calls[0][0];
    expect(call.skip).toBe(20);
    expect(call.take).toBe(20);
    expect(result.pagination.totalPages).toBe(3);
  });
});

describe('getLhAnnouncementDetail', () => {
  it('includes supplies and attachments + serializes BigInt', async () => {
    mocked.lhAnnouncement.findUnique.mockResolvedValue({
      id: 7,
      panNm: '경기 부천 임대',
      supplies: [{ id: 10, listType: '02', lsGmy: 84196000n, mmRfe: 669250 }],
      attachments: [{ id: 99, ahflUrl: 'https://lh.or.kr/file.pdf', cmnAhflNm: '공고문' }],
    });
    const detail = await getLhAnnouncementDetail(7);
    expect(detail.supplies[0].lsGmy).toBe(84196000);
    expect(detail.attachments[0].cmnAhflNm).toBe('공고문');
    const call = mocked.lhAnnouncement.findUnique.mock.calls[0][0];
    expect(call.include).toMatchObject({ supplies: expect.any(Object), attachments: true });
  });

  it('throws NotFoundError on missing id', async () => {
    mocked.lhAnnouncement.findUnique.mockResolvedValue(null);
    await expect(getLhAnnouncementDetail(404)).rejects.toBeInstanceOf(NotFoundError);
  });
});
