import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateSourceId,
  parseXmlResponse,
  buildApiUrl,
  getAllLawdCodes,
  fetchRealEstateData,
} from '../../src/services/syncRealEstateBase';

// Mock Prisma
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    region: {
      findMany: vi.fn(),
    },
  },
}));

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// 실제 국토교통부 API 응답 XML 샘플
const SAMPLE_XML_SINGLE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<response>
  <header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>
  <body>
    <items>
      <item>
        <거래금액>82,500</거래금액>
        <건축년도>2008</건축년도>
        <년>2024</년>
        <법정동>역삼동</법정동>
        <아파트>래미안</아파트>
        <월>1</월>
        <일>15</일>
        <전용면적>84.82</전용면적>
        <지번>123</지번>
        <지역코드>11680</지역코드>
        <층>12</층>
      </item>
    </items>
    <numOfRows>10</numOfRows>
    <pageNo>1</pageNo>
    <totalCount>1</totalCount>
  </body>
</response>`;

const SAMPLE_XML_MULTIPLE = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<response>
  <header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>
  <body>
    <items>
      <item>
        <거래금액>82,500</거래금액>
        <건축년도>2008</건축년도>
        <년>2024</년>
        <법정동>역삼동</법정동>
        <아파트>래미안</아파트>
        <월>1</월>
        <일>15</일>
        <전용면적>84.82</전용면적>
        <지번>123</지번>
        <지역코드>11680</지역코드>
        <층>12</층>
      </item>
      <item>
        <거래금액>120,000</거래금액>
        <건축년도>2015</건축년도>
        <년>2024</년>
        <법정동>삼성동</법정동>
        <아파트>아이파크</아파트>
        <월>2</월>
        <일>20</일>
        <전용면적>102.45</전용면적>
        <지번>456</지번>
        <지역코드>11680</지역코드>
        <층>5</층>
      </item>
    </items>
    <numOfRows>10</numOfRows>
    <pageNo>1</pageNo>
    <totalCount>2</totalCount>
  </body>
</response>`;

const SAMPLE_XML_EMPTY = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<response>
  <header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>
  <body>
    <items/>
    <numOfRows>10</numOfRows>
    <pageNo>1</pageNo>
    <totalCount>0</totalCount>
  </body>
</response>`;

const SAMPLE_XML_ERROR = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<response>
  <header><resultCode>99</resultCode><resultMsg>INVALID_REQUEST_PARAMETER_ERROR</resultMsg></header>
  <body/>
</response>`;

describe('generateSourceId', () => {
  it('should generate deterministic sourceId from category and fields', () => {
    const fields = {
      bjdCode: '11680',
      buildYear: '2008',
      dealYear: '2024',
      dealMonth: '1',
      dealDay: '15',
      floor: '12',
      area: '84.82',
    };
    const id1 = generateSourceId('apt-trade', fields);
    const id2 = generateSourceId('apt-trade', fields);
    expect(id1).toBe(id2);
  });

  it('should include category in sourceId', () => {
    const fields = {
      bjdCode: '11680',
      buildYear: '2008',
      dealYear: '2024',
      dealMonth: '1',
      dealDay: '15',
      floor: '12',
      area: '84.82',
    };
    const aptId = generateSourceId('apt-trade', fields);
    const offtId = generateSourceId('offt-trade', fields);
    expect(aptId).not.toBe(offtId);
  });

  it('should produce different IDs for different fields', () => {
    const fields1 = {
      bjdCode: '11680',
      buildYear: '2008',
      dealYear: '2024',
      dealMonth: '1',
      dealDay: '15',
      floor: '12',
      area: '84.82',
    };
    const fields2 = {
      bjdCode: '11680',
      buildYear: '2008',
      dealYear: '2024',
      dealMonth: '1',
      dealDay: '15',
      floor: '5',
      area: '102.45',
    };
    const id1 = generateSourceId('apt-trade', fields1);
    const id2 = generateSourceId('apt-trade', fields2);
    expect(id1).not.toBe(id2);
  });

  it('should produce a non-empty string', () => {
    const fields = {
      bjdCode: '11680',
      buildYear: '2008',
      dealYear: '2024',
      dealMonth: '1',
      dealDay: '15',
      floor: '12',
      area: '84.82',
    };
    const id = generateSourceId('apt-trade', fields);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('should handle missing optional fields gracefully', () => {
    const fields = {
      bjdCode: '11680',
      buildYear: '',
      dealYear: '2024',
      dealMonth: '1',
      dealDay: '',
      floor: '',
      area: '',
    };
    expect(() => generateSourceId('apt-trade', fields)).not.toThrow();
  });
});

describe('parseXmlResponse', () => {
  it('should parse single item response into array', () => {
    const result = parseXmlResponse(SAMPLE_XML_SINGLE);
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]['거래금액']).toBe('82,500');
    expect(result.items[0]['아파트']).toBe('래미안');
  });

  it('should parse multiple items response into array', () => {
    const result = parseXmlResponse(SAMPLE_XML_MULTIPLE);
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]['법정동']).toBe('역삼동');
    expect(result.items[1]['법정동']).toBe('삼성동');
  });

  it('should return empty array for empty items', () => {
    const result = parseXmlResponse(SAMPLE_XML_EMPTY);
    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items).toHaveLength(0);
  });

  it('should return resultCode and resultMsg from header', () => {
    const result = parseXmlResponse(SAMPLE_XML_SINGLE);
    expect(result.resultCode).toBe('00');
    expect(result.resultMsg).toBe('NORMAL SERVICE.');
  });

  it('should return totalCount from body', () => {
    const result = parseXmlResponse(SAMPLE_XML_SINGLE);
    expect(result.totalCount).toBe(1);
  });

  it('should detect error resultCode', () => {
    const result = parseXmlResponse(SAMPLE_XML_ERROR);
    expect(result.resultCode).toBe('99');
    expect(result.resultMsg).toBe('INVALID_REQUEST_PARAMETER_ERROR');
  });

  it('should throw on malformed XML', () => {
    expect(() => parseXmlResponse('not xml at all <<< broken')).toThrow();
  });
});

describe('buildApiUrl', () => {
  it('should build URL with serviceKey and params', () => {
    const url = buildApiUrl('RTMSDataSvcAptTrade', {
      serviceKey: 'testKey123',
      LAWD_CD: '11680',
      DEAL_YMD: '202401',
      numOfRows: '100',
      pageNo: '1',
    });
    expect(url).toContain('RTMSDataSvcAptTrade');
    expect(url).toContain('serviceKey=testKey123');
    expect(url).toContain('LAWD_CD=11680');
    expect(url).toContain('DEAL_YMD=202401');
  });

  it('should return a valid URL string', () => {
    const url = buildApiUrl('RTMSDataSvcAptTrade', {
      serviceKey: 'key',
      LAWD_CD: '11680',
      DEAL_YMD: '202401',
    });
    expect(() => new URL(url)).not.toThrow();
  });

  it('should handle different service names', () => {
    const aptUrl = buildApiUrl('RTMSDataSvcAptTrade', { serviceKey: 'k' });
    const rentUrl = buildApiUrl('RTMSDataSvcAptRent', { serviceKey: 'k' });
    expect(aptUrl).not.toBe(rentUrl);
    expect(aptUrl).toContain('RTMSDataSvcAptTrade');
    expect(rentUrl).toContain('RTMSDataSvcAptRent');
  });

  it('should encode special characters in params', () => {
    const url = buildApiUrl('RTMSDataSvcAptTrade', {
      serviceKey: 'key+with+special==chars',
    });
    // URL should be parseable and serviceKey should survive encode/decode cycle
    const parsed = new URL(url);
    expect(parsed.searchParams.get('serviceKey')).toBe('key+with+special==chars');
  });
});

describe('getAllLawdCodes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return distinct 5-digit bjdCodes from Region table', async () => {
    const { prisma } = await import('../../src/lib/prisma');
    vi.mocked(prisma.region.findMany).mockResolvedValue([
      { bjdCode: '11680' } as Parameters<typeof prisma.region.findMany>[0] extends undefined ? never : Awaited<ReturnType<typeof prisma.region.findMany>>[number],
      { bjdCode: '11110' } as Parameters<typeof prisma.region.findMany>[0] extends undefined ? never : Awaited<ReturnType<typeof prisma.region.findMany>>[number],
      { bjdCode: '26110' } as Parameters<typeof prisma.region.findMany>[0] extends undefined ? never : Awaited<ReturnType<typeof prisma.region.findMany>>[number],
    ] as Awaited<ReturnType<typeof prisma.region.findMany>>);

    const codes = await getAllLawdCodes();
    expect(Array.isArray(codes)).toBe(true);
    expect(codes).toHaveLength(3);
    expect(codes).toContain('11680');
    expect(codes).toContain('11110');
    expect(codes).toContain('26110');
  });

  it('should return empty array when no regions exist', async () => {
    const { prisma } = await import('../../src/lib/prisma');
    vi.mocked(prisma.region.findMany).mockResolvedValue([]);

    const codes = await getAllLawdCodes();
    expect(codes).toHaveLength(0);
  });

  it('should call prisma.region.findMany with distinct bjdCode select', async () => {
    const { prisma } = await import('../../src/lib/prisma');
    vi.mocked(prisma.region.findMany).mockResolvedValue([]);

    await getAllLawdCodes();

    expect(prisma.region.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ bjdCode: true }),
        distinct: expect.arrayContaining(['bjdCode']),
      })
    );
  });
});

describe('fetchRealEstateData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return parsed items from API response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_XML_SINGLE,
    });

    const items = await fetchRealEstateData(
      'RTMSDataSvcAptTrade',
      '11680',
      '202401',
      'testServiceKey'
    );

    expect(Array.isArray(items)).toBe(true);
    expect(items).toHaveLength(1);
    expect(items[0]['아파트']).toBe('래미안');
  });

  it('should return multiple items', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_XML_MULTIPLE,
    });

    const items = await fetchRealEstateData(
      'RTMSDataSvcAptTrade',
      '11680',
      '202401',
      'testServiceKey'
    );

    expect(items).toHaveLength(2);
  });

  it('should return empty array for empty response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_XML_EMPTY,
    });

    const items = await fetchRealEstateData(
      'RTMSDataSvcAptTrade',
      '11680',
      '202401',
      'testServiceKey'
    );

    expect(items).toHaveLength(0);
  });

  it('should throw on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(
      fetchRealEstateData('RTMSDataSvcAptTrade', '11680', '202401', 'testServiceKey')
    ).rejects.toThrow();
  });

  it('should throw on API error resultCode', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_XML_ERROR,
    });

    await expect(
      fetchRealEstateData('RTMSDataSvcAptTrade', '11680', '202401', 'testServiceKey')
    ).rejects.toThrow();
  });

  it('should call fetch with correct URL containing lawdCd and dealYmd', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => SAMPLE_XML_SINGLE,
    });

    await fetchRealEstateData('RTMSDataSvcAptTrade', '11680', '202401', 'myKey');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl: string = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('11680');
    expect(calledUrl).toContain('202401');
    expect(calledUrl).toContain('myKey');
  });
});
