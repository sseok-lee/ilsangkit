import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCompleteTrashPages } from '../../src/scripts/syncTrash.js';

vi.mock('../../src/lib/prisma.js', () => ({ prisma: {}, default: {} }));

const fetchMock = vi.fn();

function page(pageNo: number, numOfRows: number, totalCount: number, itemCount: number) {
  return {
    ok: true,
    json: async () => ({
      response: {
        header: { resultCode: '0', resultMsg: '정상' },
        body: {
          pageNo,
          numOfRows,
          totalCount,
          items: Array.from({ length: itemCount }, (_, index) => ({
            MNG_NO: `source-${(pageNo - 1) * numOfRows + index + 1}`,
            CTPV_NM: '서울특별시',
            SGG_NM: '강남구',
          })),
        },
      },
    }),
  };
}

describe('complete trash collection with provider pagination limits', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('collects every row when the provider caps a 1000-row request at 100', async () => {
    fetchMock
      .mockResolvedValueOnce(page(1, 100, 250, 100))
      .mockResolvedValueOnce(page(2, 100, 250, 100))
      .mockResolvedValueOnce(page(3, 100, 250, 50));

    const result = await fetchCompleteTrashPages('fixture-key', 1000);

    expect(result.totalCount).toBe(250);
    expect(result.items).toHaveLength(250);
    expect(result.items[249].MNG_NO).toBe('source-250');
    expect(result.pages.map(({ pageNo, itemCount }) => [pageNo, itemCount]))
      .toEqual([[1, 100], [2, 100], [3, 50]]);
    expect(fetchMock.mock.calls.map(([url]) => {
      const params = new URL(url).searchParams;
      return [params.get('pageNo'), params.get('numOfRows')];
    })).toEqual([['1', '1000'], ['2', '100'], ['3', '100']]);
  });

  it('rejects a page-size change after the first page', async () => {
    fetchMock
      .mockResolvedValueOnce(page(1, 100, 250, 100))
      .mockResolvedValueOnce(page(2, 50, 250, 50));

    await expect(fetchCompleteTrashPages('fixture-key', 1000)).rejects.toThrow(/page size/i);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects a truncated page before collecting later pages', async () => {
    fetchMock.mockResolvedValueOnce(page(1, 100, 250, 99));

    await expect(fetchCompleteTrashPages('fixture-key', 1000)).rejects.toThrow(/item count/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, 1.5])('rejects an invalid provider page size: %s', async (size) => {
    fetchMock.mockResolvedValueOnce(page(1, size, 250, 0));

    await expect(fetchCompleteTrashPages('fixture-key', 1000)).rejects.toThrow(/page size/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([-1, 1.5])('rejects an invalid provider total count: %s', async (count) => {
    fetchMock.mockResolvedValueOnce(page(1, 100, count, 0));

    await expect(fetchCompleteTrashPages('fixture-key', 1000)).rejects.toThrow(/total count/i);
  });

  it('accepts a complete empty response without requesting another page', async () => {
    fetchMock.mockResolvedValueOnce(page(1, 100, 0, 0));

    const result = await fetchCompleteTrashPages('fixture-key', 1000);

    expect(result.items).toEqual([]);
    expect(result.totalCount).toBe(0);
    expect(result.pages).toHaveLength(1);
  });
});
