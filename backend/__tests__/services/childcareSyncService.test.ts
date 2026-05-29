import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchChildcarePage,
  transformChildcareItem,
  toIntOrNull,
  type ChildcareAPIItem,
} from '../../src/services/childcareSyncService.js';

describe('toIntOrNull', () => {
  it('converts numeric string to integer', () => {
    expect(toIntOrNull('42')).toBe(42);
  });

  it('returns null for empty string', () => {
    expect(toIntOrNull('')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(toIntOrNull(undefined)).toBeNull();
  });

  it('converts number directly', () => {
    expect(toIntOrNull(10)).toBe(10);
  });

  it('returns null for non-numeric string', () => {
    expect(toIntOrNull('abc')).toBeNull();
  });
});

describe('fetchChildcarePage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const successXml = `
    <response>
      <totalCount>1</totalCount>
      <item>
        <stcode>CC-001</stcode>
        <crname>행복어린이집</crname>
      </item>
    </response>
  `;

  it('retries transient fetch failures such as ECONNRESET', async () => {
    const resetError = Object.assign(new TypeError('fetch failed'), {
      cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
    });
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(resetError)
      .mockResolvedValueOnce(new Response(successXml, { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchChildcarePage('api-key', '28710', 1, {
      maxRetries: 2,
      retryDelayMs: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.totalCount).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].stcode).toBe('CC-001');
  });

  it('retries retryable HTTP responses', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('temporary unavailable', {
        status: 503,
        statusText: 'Service Unavailable',
      }))
      .mockResolvedValueOnce(new Response(successXml, { status: 200 }));

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchChildcarePage('api-key', '28710', 1, {
      maxRetries: 2,
      retryDelayMs: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.items[0].crname).toBe('행복어린이집');
  });

  it('does not retry non-retryable HTTP responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('bad request', { status: 400, statusText: 'Bad Request' })
    );

    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchChildcarePage('api-key', '28710', 1, {
      maxRetries: 3,
      retryDelayMs: 0,
    })).rejects.toThrow('API request failed: 400 Bad Request');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('transformChildcareItem', () => {
  const baseItem: ChildcareAPIItem = {
    sidoname: '서울특별시',
    sigunname: '강남구',
    stcode: 'CC-001',
    crname: '행복어린이집',
    crtypename: '국공립어린이집',
    crstatusname: '정상',
    zipcode: '06025',
    craddr: '서울특별시 강남구 테헤란로 123',
    crtelno: '02-1234-5678',
    crfaxno: '02-1234-5679',
    crhome: 'https://example.com',
    CRREPNAME: '홍길동',
    nrtrroomcnt: '5',
    nrtrroomsize: '120.5',
    plgrdco: '2',
    cctvinstlcnt: '10',
    chcrtescnt: '3',
    crcapat: '50',
    crchcnt: '45',
    la: '37.4979517',
    lo: '127.0276188',
    crcargbname: '운행',
    crcnfmdt: '20100101',
    crpausebegindt: '',
    crpauseenddt: '',
    crabldt: '',
    datastdrdt: '20240101',
    crspec: '',
    CLASS_CNT_00: '5',
    CLASS_CNT_01: '10',
    CLASS_CNT_02: '10',
    CLASS_CNT_03: '10',
    CLASS_CNT_04: '10',
    CLASS_CNT_05: '5',
    CLASS_CNT_M2: '0',
    CLASS_CNT_M5: '0',
    CLASS_CNT_SP: '0',
    CLASS_CNT_TOT: '50',
    CHILD_CNT_00: '4',
    CHILD_CNT_01: '9',
    CHILD_CNT_02: '9',
    CHILD_CNT_03: '9',
    CHILD_CNT_04: '9',
    CHILD_CNT_05: '5',
    CHILD_CNT_M2: '0',
    CHILD_CNT_M5: '0',
    CHILD_CNT_SP: '0',
    CHILD_CNT_TOT: '45',
    EM_CNT_0Y: '1',
    EM_CNT_1Y: '2',
    EM_CNT_2Y: '2',
    EM_CNT_4Y: '1',
    EM_CNT_6Y: '1',
    EM_CNT_A1: '1',
    EM_CNT_A2: '7',
    EM_CNT_A3: '0',
    EM_CNT_A4: '0',
    EM_CNT_A5: '1',
    EM_CNT_A6: '0',
    EM_CNT_A10: '1',
    EM_CNT_A7: '0',
    EM_CNT_A8: '0',
    EM_CNT_TOT: '10',
    EW_CNT_00: '1',
    EW_CNT_01: '2',
    EW_CNT_02: '2',
    EW_CNT_03: '2',
    EW_CNT_04: '2',
    EW_CNT_05: '1',
    EW_CNT_M6: '0',
    EW_CNT_TOT: '10',
  };

  it('should transform item with correct field mapping', () => {
    const result = transformChildcareItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.name).toBe('행복어린이집');
    expect(result!.crtypename).toBe('국공립어린이집');
    expect(result!.crtelno).toBe('02-1234-5678');
    expect(result!.crfaxno).toBe('02-1234-5679');
    expect(result!.crhome).toBe('https://example.com');
    expect(result!.crrepname).toBe('홍길동');
    expect(result!.crcapat).toBe(50);
    expect(result!.crchcnt).toBe(45);
    expect(result!.datastdrdt).toBe('20240101');
  });

  it('should use stcode as sourceId', () => {
    const result = transformChildcareItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.sourceId).toBe('CC-001');
    expect(result!.id).toBe('childcare-CC-001');
  });

  it('should parse address to extract city and district', () => {
    const result = transformChildcareItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.city).toBe('서울');
    expect(result!.district).toBe('강남구');
  });

  it('should validate coordinates within KOREA_BOUNDS', () => {
    const result = transformChildcareItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(37.4979517, 5);
    expect(result!.lng).toBeCloseTo(127.0276188, 5);
  });

  it('should return null lat/lng for coordinates outside KOREA_BOUNDS', () => {
    const item: ChildcareAPIItem = {
      ...baseItem,
      la: '10.0',   // outside Korea
      lo: '100.0',
    };

    const result = transformChildcareItem(item);
    expect(result).not.toBeNull();
    expect(result!.lat).toBeNull();
    expect(result!.lng).toBeNull();
  });

  it('should return null lat/lng for missing coordinates', () => {
    const item: ChildcareAPIItem = {
      ...baseItem,
      la: '',
      lo: '',
    };

    const result = transformChildcareItem(item);
    expect(result).not.toBeNull();
    expect(result!.lat).toBeNull();
    expect(result!.lng).toBeNull();
  });

  it('should convert Int fields correctly', () => {
    const result = transformChildcareItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.nrtrroomcnt).toBe(5);
    expect(result!.plgrdco).toBe(2);
    expect(result!.cctvinstlcnt).toBe(10);
    expect(result!.classCnt00).toBe(5);
    expect(result!.classCntTot).toBe(50);
    expect(result!.childCntTot).toBe(45);
    expect(result!.emCntTot).toBe(10);
    expect(result!.ewCntTot).toBe(10);
  });

  it('should convert empty string to null for optional fields', () => {
    const result = transformChildcareItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.crpausebegindt).toBeNull();
    expect(result!.crpauseenddt).toBeNull();
    expect(result!.crabldt).toBeNull();
    expect(result!.crspec).toBeNull();
  });

  it('should return null when stcode is missing', () => {
    const item: ChildcareAPIItem = {
      ...baseItem,
      stcode: '',
    };

    const result = transformChildcareItem(item);
    expect(result).toBeNull();
  });

  it('should return null when crname is missing', () => {
    const item: ChildcareAPIItem = {
      ...baseItem,
      crname: '',
    };

    const result = transformChildcareItem(item);
    expect(result).toBeNull();
  });

  it('should return null when address is missing', () => {
    const item: ChildcareAPIItem = {
      ...baseItem,
      craddr: '',
    };

    const result = transformChildcareItem(item);
    expect(result).toBeNull();
  });

  it('should map all class count fields correctly', () => {
    const result = transformChildcareItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.classCnt00).toBe(5);
    expect(result!.classCnt01).toBe(10);
    expect(result!.classCnt02).toBe(10);
    expect(result!.classCnt03).toBe(10);
    expect(result!.classCnt04).toBe(10);
    expect(result!.classCnt05).toBe(5);
    expect(result!.classCntM2).toBe(0);
    expect(result!.classCntM5).toBe(0);
    expect(result!.classCntSp).toBe(0);
    expect(result!.classCntTot).toBe(50);
  });

  it('should map all employee count fields correctly', () => {
    const result = transformChildcareItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.emCnt0y).toBe(1);
    expect(result!.emCnt1y).toBe(2);
    expect(result!.emCntA1).toBe(1);
    expect(result!.emCntA2).toBe(7);
    expect(result!.emCntA10).toBe(1);
    expect(result!.emCntTot).toBe(10);
  });

  it('should handle numeric values for Int fields', () => {
    const item: ChildcareAPIItem = {
      ...baseItem,
      nrtrroomcnt: 8,
      crcapat: 60,
    };

    const result = transformChildcareItem(item);
    expect(result).not.toBeNull();
    expect(result!.nrtrroomcnt).toBe(8);
    expect(result!.crcapat).toBe(60);
  });
});
