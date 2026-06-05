import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLand } from '~/composables/useLand';

describe('useLand', () => {
  beforeEach(() => {
    (globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0, page: 1, totalPages: 0 } });
  });

  it('getRegions: /regions + city/district/page 쿼리', async () => {
    await useLand().getRegions({ city: '서울특별시', district: '강남구', page: 2, limit: 20 });
    const url = (globalThis as any).$fetch.mock.calls[0][0] as string;
    expect(url).toContain('/api/real-estate/land/regions');
    expect(decodeURIComponent(url)).toContain('city=서울특별시');
    expect(decodeURIComponent(url)).toContain('district=강남구');
    expect(url).toContain('page=2');
  });

  it('getRegionDetail: /region + bjdCode/dongName', async () => {
    await useLand().getRegionDetail({ bjdCode: '11680', dongName: '역삼동', page: 1, limit: 20 });
    const url = (globalThis as any).$fetch.mock.calls[0][0] as string;
    expect(url).toContain('/api/real-estate/land/region');
    expect(url).toContain('bjdCode=11680');
    expect(decodeURIComponent(url)).toContain('dongName=역삼동');
  });

  it('getHubSummary: /hub-summary', async () => {
    (globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: { cities: [], totalTransactions: 0 } });
    await useLand().getHubSummary();
    expect((globalThis as any).$fetch.mock.calls[0][0]).toContain('/api/real-estate/land/hub-summary');
  });

  it('getTransactions: /transactions + bjdCode/dongName/page 쿼리', async () => {
    (globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0, page: 1, totalPages: 0 } });
    await useLand().getTransactions({ bjdCode: '11680', dongName: '역삼동', page: 2, limit: 20 });
    const url = (globalThis as any).$fetch.mock.calls[0][0] as string;
    expect(url).toContain('/api/real-estate/land/transactions');
    expect(url).toContain('bjdCode=11680');
    expect(decodeURIComponent(url)).toContain('dongName=역삼동');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=20');
  });

  it('getTransactions: page/limit 생략 시 URL에서 누락', async () => {
    (globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0, page: 1, totalPages: 0 } });
    await useLand().getTransactions({ bjdCode: '11680', dongName: '역삼동' });
    const url = (globalThis as any).$fetch.mock.calls[0][0] as string;
    expect(url).toContain('/api/real-estate/land/transactions');
    expect(url).not.toContain('page=');
    expect(url).not.toContain('limit=');
  });
});
