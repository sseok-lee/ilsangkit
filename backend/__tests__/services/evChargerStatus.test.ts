import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchChargerStatus } from '../../src/services/evChargerService';

describe('fetchChargerStatus', () => {
  const originalEnv = process.env.OPENAPI_SERVICE_KEY;

  beforeEach(() => {
    process.env.OPENAPI_SERVICE_KEY = 'test-key';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.OPENAPI_SERVICE_KEY = originalEnv;
  });

  it('statId로 충전기 상태 목록을 반환한다', async () => {
    const mockResponse = {
      items: {
        item: [
          { statId: 'ST001', chgerId: '01', stat: '2', statUpdDt: '20260410120000' },
          { statId: 'ST001', chgerId: '02', stat: '3', statUpdDt: '20260410120100' },
        ],
      },
      totalCount: 2,
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await fetchChargerStatus('ST001');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      chgerId: '01',
      stat: '2',
      statUpdDt: '20260410120000',
    });
    expect(result[1]).toEqual({
      chgerId: '02',
      stat: '3',
      statUpdDt: '20260410120100',
    });
  });

  it('API 호출 시 statId 파라미터를 포함한다', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: { item: [] }, totalCount: 0 }),
    } as Response);

    await fetchChargerStatus('ME101010');

    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain('getChargerStatus');
    expect(calledUrl).toContain('statId=ME101010');
  });

  it('OPENAPI_SERVICE_KEY 없으면 에러를 던진다', async () => {
    delete process.env.OPENAPI_SERVICE_KEY;

    await expect(fetchChargerStatus('ST001')).rejects.toThrow('OPENAPI_SERVICE_KEY');
  });

  it('API 응답 실패 시 빈 배열을 반환한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const result = await fetchChargerStatus('ST001');
    expect(result).toEqual([]);
  });

  it('API 응답에 item이 없으면 빈 배열을 반환한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: {}, totalCount: 0 }),
    } as Response);

    const result = await fetchChargerStatus('ST001');
    expect(result).toEqual([]);
  });

  it('item이 단일 객체이면 배열로 변환한다', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: {
          item: { statId: 'ST001', chgerId: '01', stat: '2', statUpdDt: '20260410120000' },
        },
        totalCount: 1,
      }),
    } as Response);

    const result = await fetchChargerStatus('ST001');
    expect(result).toHaveLength(1);
    expect(result[0].chgerId).toBe('01');
  });
});
