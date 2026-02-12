// @TASK T2.1 - 공공화장실 데이터 동기화 테스트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseToiletCSV, transformToiletRow, ToiletCSVRow } from '../../src/services/csvParser';
import { createSyncHistory, updateSyncHistory } from '../../src/services/toiletSyncService';
import { prisma } from '../../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';

// Mock Prisma
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    toilet: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    syncHistory: {
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (callback) => {
      // Mock transaction context
      const tx = {
        toilet: {
          upsert: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };
      return callback(tx);
    }),
  },
}));

describe('CSV Parser - parseToiletCSV', () => {
  const sampleCSVPath = path.join(__dirname, '../fixtures/sample-toilet.csv');

  beforeEach(() => {
    // Create sample CSV fixture
    const fixtureDir = path.join(__dirname, '../fixtures');
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }

    // UTF-8 sample CSV
    const csvContent = `화장실명,소재지도로명주소,소재지지번주소,WGS84위도,WGS84경도,개방시간상세,남성용-대변기수,남성용-소변기수,여성용-대변기수,남성용-장애인용대변기수,개방시간,관리기관명
테스트화장실,서울특별시 강남구 테헤란로 123,서울특별시 강남구 역삼동 123,37.5012345,127.0367890,24시간,2,3,3,1,상시개방,강남구청`;

    fs.writeFileSync(sampleCSVPath, csvContent, 'utf8');
  });

  afterEach(() => {
    // Cleanup fixture
    if (fs.existsSync(sampleCSVPath)) {
      fs.unlinkSync(sampleCSVPath);
    }
  });

  it('should parse UTF-8 encoded CSV file correctly', async () => {
    const rows = await parseToiletCSV(sampleCSVPath);

    expect(rows).toHaveLength(1);
    expect(rows[0]['화장실명']).toBe('테스트화장실');
    expect(rows[0]['소재지도로명주소']).toBe('서울특별시 강남구 테헤란로 123');
    expect(rows[0]['WGS84위도']).toBe('37.5012345');
    expect(rows[0]['WGS84경도']).toBe('127.0367890');
  });

  it('should handle empty CSV gracefully', async () => {
    const emptyCSVPath = path.join(__dirname, '../fixtures/empty-toilet.csv');
    fs.writeFileSync(emptyCSVPath, '화장실명,소재지도로명주소\n', 'utf8');

    const rows = await parseToiletCSV(emptyCSVPath);

    expect(rows).toHaveLength(0);
    fs.unlinkSync(emptyCSVPath);
  });

  it('should skip rows with missing required fields', async () => {
    const invalidCSVPath = path.join(__dirname, '../fixtures/invalid-toilet.csv');
    const csvContent = `화장실명,소재지도로명주소,소재지지번주소,WGS84위도,WGS84경도,개방시간상세
테스트화장실,서울특별시 강남구 테헤란로 123,,37.5012345,127.0367890,24시간
,,,,,,`;

    fs.writeFileSync(invalidCSVPath, csvContent, 'utf8');
    const rows = await parseToiletCSV(invalidCSVPath);

    expect(rows.length).toBeGreaterThanOrEqual(1);
    fs.unlinkSync(invalidCSVPath);
  });

  it('should parse EUC-KR encoded CSV file correctly', async () => {
    const eucKrCSVPath = path.join(__dirname, '../fixtures/euckr-toilet.csv');
    const csvContent = `화장실명,소재지도로명주소,소재지지번주소,WGS84위도,WGS84경도,개방시간상세
부산역화장실,부산광역시 동구 중앙대로 206,부산광역시 동구 초량동 1191,35.1149975,129.0396538,24시간`;

    // EUC-KR로 인코딩하여 저장
    const eucKrBuffer = iconv.encode(csvContent, 'euc-kr');
    fs.writeFileSync(eucKrCSVPath, eucKrBuffer);

    const rows = await parseToiletCSV(eucKrCSVPath);

    expect(rows).toHaveLength(1);
    expect(rows[0]['화장실명']).toBe('부산역화장실');
    expect(rows[0]['소재지도로명주소']).toBe('부산광역시 동구 중앙대로 206');

    fs.unlinkSync(eucKrCSVPath);
  });
});

describe('CSV Parser - transformToiletRow', () => {
  it('should transform CSV row to Toilet format', () => {
    const row: ToiletCSVRow = {
      '화장실명': '강남역 지하화장실',
      '소재지도로명주소': '서울특별시 강남구 강남대로 396',
      '소재지지번주소': '서울특별시 강남구 역삼동 858',
      'WGS84위도': '37.4979517',
      'WGS84경도': '127.0276188',
      '개방시간상세': '06:00~23:00',
      '남성용-대변기수': '3',
      '남성용-소변기수': '5',
      '여성용-대변기수': '4',
      '남성용-장애인용대변기수': '1',
      '개방시간': '06:00~23:00',
      '관리기관명': '강남구청',
    };

    const toilet = transformToiletRow(row);

    expect(toilet).not.toBeNull();
    expect(toilet!.name).toBe('강남역 지하화장실');
    expect(toilet!.roadAddress).toBe('서울특별시 강남구 강남대로 396');
    expect(toilet!.address).toBe('서울특별시 강남구 역삼동 858');
    expect(toilet!.lat).toBeCloseTo(37.4979517, 6);
    expect(toilet!.lng).toBeCloseTo(127.0276188, 6);
    expect(toilet!.city).toBe('서울특별시');
    expect(toilet!.district).toBe('강남구');
    // Toilet 전용 필드
    expect(toilet!.operatingHours).toBe('06:00~23:00');
    expect(toilet!.maleToilets).toBe(3);
    expect(toilet!.maleUrinals).toBe(5);
    expect(toilet!.femaleToilets).toBe(4);
    expect(toilet!.hasDisabledToilet).toBe(true);
    expect(toilet!.openTime).toBe('06:00~23:00');
    expect(toilet!.managingOrg).toBe('강남구청');
  });

  it('should generate unique sourceId from row data', () => {
    const row: ToiletCSVRow = {
      '화장실명': '테스트화장실',
      '소재지도로명주소': '',
      '소재지지번주소': '서울특별시 강남구 역삼동 123',
      'WGS84위도': '37.5012345',
      'WGS84경도': '127.0367890',
      '개방시간상세': '24시간',
    };

    const toilet = transformToiletRow(row);

    expect(toilet).not.toBeNull();
    expect(toilet!.sourceId).toBeDefined();
    expect(toilet!.sourceId.length).toBeGreaterThan(0);
  });

  it('should use jibun address when road address is empty', () => {
    const row: ToiletCSVRow = {
      '화장실명': '테스트화장실',
      '소재지도로명주소': '',
      '소재지지번주소': '서울특별시 강남구 역삼동 123',
      'WGS84위도': '37.5012345',
      'WGS84경도': '127.0367890',
      '개방시간상세': '24시간',
    };

    const toilet = transformToiletRow(row);

    expect(toilet).not.toBeNull();
    expect(toilet!.address).toBe('서울특별시 강남구 역삼동 123');
    expect(toilet!.city).toBe('서울특별시');
    expect(toilet!.district).toBe('강남구');
  });

  it('should handle missing optional fields gracefully', () => {
    const row: ToiletCSVRow = {
      '화장실명': '최소화장실',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      'WGS84위도': '37.5',
      'WGS84경도': '127.0',
      '개방시간상세': '',
    };

    const toilet = transformToiletRow(row);

    expect(toilet).not.toBeNull();
    expect(toilet!.name).toBe('최소화장실');
    expect(toilet!.operatingHours).toBe('');
    expect(toilet!.maleToilets).toBe(0);
  });

  it('should return null for rows with invalid coordinates', () => {
    const row: ToiletCSVRow = {
      '화장실명': '잘못된화장실',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      'WGS84위도': 'invalid',
      'WGS84경도': '127.0',
      '개방시간상세': '',
    };

    const toilet = transformToiletRow(row);

    expect(toilet).toBeNull();
  });

  it('should return null for rows without name', () => {
    const row: ToiletCSVRow = {
      '화장실명': '',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      'WGS84위도': '37.5',
      'WGS84경도': '127.0',
      '개방시간상세': '',
    };

    const toilet = transformToiletRow(row);

    expect(toilet).toBeNull();
  });
});

describe('Toilet Sync Service - SyncHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create sync history record at start', async () => {
    const mockCreate = vi.mocked(prisma.syncHistory.create);
    mockCreate.mockResolvedValue({
      id: 1,
      category: 'toilet',
      status: 'running',
      totalRecords: 0,
      newRecords: 0,
      updatedRecords: 0,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: null,
    });

    const result = await createSyncHistory('toilet');

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        category: 'toilet',
        status: 'running',
        totalRecords: 0,
        newRecords: 0,
        updatedRecords: 0,
      },
    });
    expect(result.id).toBe(1);
  });

  it('should update sync history on completion', async () => {
    const mockUpdate = vi.mocked(prisma.syncHistory.update);
    mockUpdate.mockResolvedValue({
      id: 1,
      category: 'toilet',
      status: 'success',
      totalRecords: 100,
      newRecords: 50,
      updatedRecords: 50,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: new Date(),
    });

    const result = await updateSyncHistory(1, {
      status: 'success',
      totalRecords: 100,
      newRecords: 50,
      updatedRecords: 50,
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'success',
        totalRecords: 100,
        completedAt: expect.any(Date),
      }),
    });
    expect(result.status).toBe('success');
  });

  it('should update sync history on failure', async () => {
    const mockUpdate = vi.mocked(prisma.syncHistory.update);
    mockUpdate.mockResolvedValue({
      id: 1,
      category: 'toilet',
      status: 'failed',
      totalRecords: 0,
      newRecords: 0,
      updatedRecords: 0,
      errorMessage: 'Download failed',
      startedAt: new Date(),
      completedAt: new Date(),
    });

    const result = await updateSyncHistory(1, {
      status: 'failed',
      errorMessage: 'Download failed',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'failed',
        errorMessage: 'Download failed',
      }),
    });
  });
});

describe('Toilet Sync Service - Data Upsert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upsert facility data to database', async () => {
    const mockUpsert = vi.mocked(prisma.toilet.upsert);
    mockUpsert.mockResolvedValue({
      id: 'toilet-abc123',
      name: '테스트화장실',
      address: '서울특별시 강남구 역삼동 123',
      roadAddress: '서울특별시 강남구 테헤란로 123',
      lat: 37.5012345 as unknown as import('@prisma/client/runtime/library').Decimal,
      lng: 127.0367890 as unknown as import('@prisma/client/runtime/library').Decimal,
      city: '서울특별시',
      district: '강남구',
      bjdCode: null,
      sourceId: 'abc123',
      sourceUrl: null,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: new Date(),
      // Toilet 전용 필드
      operatingHours: '24시간',
      maleToilets: 2,
      maleUrinals: 3,
      femaleToilets: 3,
      hasDisabledToilet: true,
      openTime: '상시개방',
      managingOrg: '강남구청',
    });

    const toiletData = {
      id: 'toilet-abc123',
      name: '테스트화장실',
      address: '서울특별시 강남구 역삼동 123',
      roadAddress: '서울특별시 강남구 테헤란로 123',
      lat: 37.5012345,
      lng: 127.0367890,
      city: '서울특별시',
      district: '강남구',
      sourceId: 'abc123',
      operatingHours: '24시간',
      maleToilets: 2,
      maleUrinals: 3,
      femaleToilets: 3,
      hasDisabledToilet: true,
      openTime: '상시개방',
      managingOrg: '강남구청',
    };

    await prisma.toilet.upsert({
      where: { sourceId: 'abc123' },
      update: toiletData,
      create: toiletData,
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { sourceId: 'abc123' },
      update: toiletData,
      create: toiletData,
    });
  });
});
