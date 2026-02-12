// @TASK T2.3.1 - 의류수거함 데이터 동기화 테스트 (CSV 기반)
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseClothesCSV, transformClothesRow, ClothesCSVRow } from '../../src/services/csvParser';
import { createSyncHistory, updateSyncHistory } from '../../src/services/clothesSyncService';
import { prisma } from '../../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';

// Mock Prisma
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    clothes: {
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
        clothes: {
          upsert: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };
      return callback(tx);
    }),
  },
}));

describe('CSV Parser - parseClothesCSV', () => {
  const sampleCSVPath = path.join(__dirname, '../fixtures/sample-clothes.csv');

  beforeEach(() => {
    // Create fixtures directory
    const fixtureDir = path.join(__dirname, '../fixtures');
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }

    // UTF-8 sample CSV
    const csvContent = `관리번호,설치장소명,시도명,시군구명,소재지도로명주소,소재지지번주소,위도,경도,상세위치,관리기관명,관리기관전화번호,데이터기준일자,제공기관코드,제공기관명
TEST-001,테스트 수거함,서울특별시,강남구,서울특별시 강남구 테헤란로 123,서울특별시 강남구 역삼동 123,37.5012345,127.0367890,빌라 앞,강남구청,02-1234-5678,2025-01-01,1234567,서울특별시`;

    fs.writeFileSync(sampleCSVPath, csvContent, 'utf8');
  });

  afterEach(() => {
    // Cleanup fixture
    if (fs.existsSync(sampleCSVPath)) {
      fs.unlinkSync(sampleCSVPath);
    }
  });

  it('should parse UTF-8 encoded CSV file correctly', async () => {
    const rows = await parseClothesCSV(sampleCSVPath);

    expect(rows).toHaveLength(1);
    expect(rows[0]['관리번호']).toBe('TEST-001');
    expect(rows[0]['설치장소명']).toBe('테스트 수거함');
    expect(rows[0]['시도명']).toBe('서울특별시');
    expect(rows[0]['위도']).toBe('37.5012345');
    expect(rows[0]['경도']).toBe('127.0367890');
  });

  it('should handle empty CSV gracefully', async () => {
    const emptyCSVPath = path.join(__dirname, '../fixtures/empty-clothes.csv');
    fs.writeFileSync(emptyCSVPath, '관리번호,설치장소명,시도명,시군구명\n', 'utf8');

    const rows = await parseClothesCSV(emptyCSVPath);

    expect(rows).toHaveLength(0);
    fs.unlinkSync(emptyCSVPath);
  });

  it('should parse EUC-KR encoded CSV file correctly', async () => {
    const eucKrCSVPath = path.join(__dirname, '../fixtures/euckr-clothes.csv');
    const csvContent = `관리번호,설치장소명,시도명,시군구명,소재지도로명주소,소재지지번주소,위도,경도,상세위치,관리기관명,관리기관전화번호,데이터기준일자
EUCKR-001,부산 수거함,부산광역시,동구,부산광역시 동구 중앙대로 206,부산광역시 동구 초량동 1191,35.1149975,129.0396538,역 앞,동구청,051-1234-5678,2025-01-01`;

    // EUC-KR로 인코딩하여 저장
    const eucKrBuffer = iconv.encode(csvContent, 'euc-kr');
    fs.writeFileSync(eucKrCSVPath, eucKrBuffer);

    const rows = await parseClothesCSV(eucKrCSVPath);

    expect(rows).toHaveLength(1);
    expect(rows[0]['설치장소명']).toBe('부산 수거함');
    expect(rows[0]['소재지도로명주소']).toBe('부산광역시 동구 중앙대로 206');

    fs.unlinkSync(eucKrCSVPath);
  });
});

describe('CSV Parser - transformClothesRow', () => {
  it('should transform CSV row to Clothes format', () => {
    const row: ClothesCSVRow = {
      '관리번호': 'CLOTHES-001',
      '설치장소명': '강남역 수거함',
      '시도명': '서울특별시',
      '시군구명': '강남구',
      '소재지도로명주소': '서울특별시 강남구 강남대로 396',
      '소재지지번주소': '서울특별시 강남구 역삼동 858',
      '위도': '37.4979517',
      '경도': '127.0276188',
      '상세위치': '역 출구 앞',
      '관리기관명': '강남구청',
      '관리기관전화번호': '02-3423-1234',
      '데이터기준일자': '2025-01-01',
    };

    const clothes = transformClothesRow(row);

    expect(clothes).not.toBeNull();
    expect(clothes!.name).toBe('강남역 수거함');
    expect(clothes!.roadAddress).toBe('서울특별시 강남구 강남대로 396');
    expect(clothes!.address).toBe('서울특별시 강남구 역삼동 858');
    expect(clothes!.lat).toBeCloseTo(37.4979517, 6);
    expect(clothes!.lng).toBeCloseTo(127.0276188, 6);
    expect(clothes!.city).toBe('서울');
    expect(clothes!.district).toBe('강남구');
    // Clothes 전용 필드
    expect(clothes!.managementAgency).toBe('강남구청');
    expect(clothes!.phoneNumber).toBe('02-3423-1234');
    expect(clothes!.dataDate).toBe('2025-01-01');
    expect(clothes!.detailLocation).toBe('역 출구 앞');
  });

  it('should normalize city names correctly', () => {
    const testCases = [
      { ctprvnNm: '서울특별시', expected: '서울' },
      { ctprvnNm: '부산광역시', expected: '부산' },
      { ctprvnNm: '경기도', expected: '경기' },
      { ctprvnNm: '제주특별자치도', expected: '제주' },
      { ctprvnNm: '세종특별자치시', expected: '세종' },
      { ctprvnNm: '강원특별자치도', expected: '강원' },
      { ctprvnNm: '전북특별자치도', expected: '전북' },
    ];

    for (const tc of testCases) {
      const row: ClothesCSVRow = {
        '관리번호': 'TEST',
        '설치장소명': '테스트',
        '시도명': tc.ctprvnNm,
        '시군구명': '테스트구',
        '소재지도로명주소': '',
        '소재지지번주소': '테스트 주소',
        '위도': '37.5',
        '경도': '127.0',
      };

      const clothes = transformClothesRow(row);

      expect(clothes).not.toBeNull();
      expect(clothes!.city).toBe(tc.expected);
    }
  });

  it('should generate unique sourceId from city-district-managementNo', () => {
    const row1: ClothesCSVRow = {
      '관리번호': 'TEST-001',
      '설치장소명': '테스트 수거함 1',
      '시도명': '서울특별시',
      '시군구명': '강남구',
      '소재지도로명주소': '',
      '소재지지번주소': '서울특별시 강남구 역삼동 123',
      '위도': '37.5012345',
      '경도': '127.0367890',
    };

    const row2: ClothesCSVRow = {
      '관리번호': 'TEST-002',
      '설치장소명': '테스트 수거함 2',
      '시도명': '서울특별시',
      '시군구명': '강남구',
      '소재지도로명주소': '',
      '소재지지번주소': '서울특별시 강남구 역삼동 456',
      '위도': '37.5023456',
      '경도': '127.0378901',
    };

    const clothes1 = transformClothesRow(row1);
    const clothes2 = transformClothesRow(row2);

    expect(clothes1).not.toBeNull();
    expect(clothes2).not.toBeNull();
    expect(clothes1!.sourceId).not.toBe(clothes2!.sourceId);
  });

  it('should use jibun address when road address is empty', () => {
    const row: ClothesCSVRow = {
      '관리번호': 'TEST-001',
      '설치장소명': '테스트 수거함',
      '시도명': '서울특별시',
      '시군구명': '강남구',
      '소재지도로명주소': '',
      '소재지지번주소': '서울특별시 강남구 역삼동 123',
      '위도': '37.5012345',
      '경도': '127.0367890',
    };

    const clothes = transformClothesRow(row);

    expect(clothes).not.toBeNull();
    expect(clothes!.address).toBe('서울특별시 강남구 역삼동 123');
    expect(clothes!.roadAddress).toBeNull();
  });

  it('should return clothes with null coordinates for rows with invalid coordinates', () => {
    const row: ClothesCSVRow = {
      '관리번호': 'TEST-001',
      '설치장소명': '잘못된 수거함',
      '시도명': '서울특별시',
      '시군구명': '강남구',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      '위도': 'invalid',
      '경도': '127.0',
    };

    const clothes = transformClothesRow(row);

    expect(clothes).not.toBeNull();
    expect(clothes!.lat).toBeNull();
    expect(clothes!.lng).toBeNull();
    expect(clothes!.name).toBe('잘못된 수거함');
  });

  it('should return clothes with null coordinates for rows with zero coordinates', () => {
    const row: ClothesCSVRow = {
      '관리번호': 'TEST-001',
      '설치장소명': '좌표없는 수거함',
      '시도명': '서울특별시',
      '시군구명': '강남구',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      '위도': '0',
      '경도': '0',
    };

    const clothes = transformClothesRow(row);

    expect(clothes).not.toBeNull();
    expect(clothes!.lat).toBeNull();
    expect(clothes!.lng).toBeNull();
    expect(clothes!.name).toBe('좌표없는 수거함');
  });

  it('should return clothes for rows without management number using address+name for sourceId', () => {
    const row: ClothesCSVRow = {
      '관리번호': '',
      '설치장소명': '테스트 수거함',
      '시도명': '서울특별시',
      '시군구명': '강남구',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      '위도': '37.5',
      '경도': '127.0',
    };

    const clothes = transformClothesRow(row);

    expect(clothes).not.toBeNull();
    expect(clothes!.name).toBe('테스트 수거함');
    expect(clothes!.city).toBe('서울');
    expect(clothes!.district).toBe('강남구');
    // sourceId는 주소+이름 조합으로 생성됨
    expect(clothes!.sourceId).toBeTruthy();
  });

  it('should use district as default name when both management number and installation place are empty', () => {
    const row: ClothesCSVRow = {
      '관리번호': '',
      '설치장소명': '',
      '시도명': '서울특별시',
      '시군구명': '강남구',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      '위도': '37.5',
      '경도': '127.0',
    };

    const clothes = transformClothesRow(row);

    expect(clothes).not.toBeNull();
    expect(clothes!.name).toBe('의류수거함 강남구');
  });

  it('should return clothes with null coordinates for rows outside Korea coordinates', () => {
    const row: ClothesCSVRow = {
      '관리번호': 'TEST-001',
      '설치장소명': '해외 수거함',
      '시도명': '서울특별시',
      '시군구명': '강남구',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      '위도': '40.7128', // New York
      '경도': '-74.0060',
    };

    const clothes = transformClothesRow(row);

    expect(clothes).not.toBeNull();
    expect(clothes!.lat).toBeNull();
    expect(clothes!.lng).toBeNull();
    expect(clothes!.name).toBe('해외 수거함');
  });

  it('should use default name when installation place is empty', () => {
    const row: ClothesCSVRow = {
      '관리번호': 'TEST-001',
      '설치장소명': '',
      '시도명': '서울특별시',
      '시군구명': '강남구',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      '위도': '37.5',
      '경도': '127.0',
    };

    const clothes = transformClothesRow(row);

    expect(clothes).not.toBeNull();
    expect(clothes!.name).toBe('의류수거함 TEST-001');
  });
});

describe('Clothes Sync Service - SyncHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create sync history record at start', async () => {
    const mockCreate = vi.mocked(prisma.syncHistory.create);
    mockCreate.mockResolvedValue({
      id: 1,
      category: 'clothes',
      status: 'running',
      totalRecords: 0,
      newRecords: 0,
      updatedRecords: 0,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: null,
    });

    const result = await createSyncHistory('clothes');

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        category: 'clothes',
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
      category: 'clothes',
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
      category: 'clothes',
      status: 'failed',
      totalRecords: 0,
      newRecords: 0,
      updatedRecords: 0,
      errorMessage: 'CSV parsing failed',
      startedAt: new Date(),
      completedAt: new Date(),
    });

    const result = await updateSyncHistory(1, {
      status: 'failed',
      errorMessage: 'CSV parsing failed',
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'failed',
        errorMessage: 'CSV parsing failed',
      }),
    });
  });
});

describe('Clothes Sync Service - Data Upsert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upsert clothes data to database', async () => {
    const mockUpsert = vi.mocked(prisma.clothes.upsert);
    mockUpsert.mockResolvedValue({
      id: 'clothes-abc123',
      name: '테스트 수거함',
      address: '서울특별시 강남구 역삼동 123',
      roadAddress: '서울특별시 강남구 테헤란로 123',
      lat: 37.5012345 as unknown as import('@prisma/client/runtime/library').Decimal,
      lng: 127.0367890 as unknown as import('@prisma/client/runtime/library').Decimal,
      city: '서울',
      district: '강남구',
      bjdCode: null,
      sourceId: 'abc123',
      sourceUrl: null,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      syncedAt: new Date(),
      // Clothes 전용 필드
      managementAgency: '강남구청',
      phoneNumber: '02-1234-5678',
      dataDate: '2025-01-01',
      detailLocation: '빌라 앞',
    });

    const clothesData = {
      id: 'clothes-abc123',
      name: '테스트 수거함',
      address: '서울특별시 강남구 역삼동 123',
      roadAddress: '서울특별시 강남구 테헤란로 123',
      lat: 37.5012345,
      lng: 127.0367890,
      city: '서울',
      district: '강남구',
      sourceId: 'abc123',
      managementAgency: '강남구청',
      phoneNumber: '02-1234-5678',
      dataDate: '2025-01-01',
      detailLocation: '빌라 앞',
    };

    await prisma.clothes.upsert({
      where: { sourceId: 'abc123' },
      update: clothesData,
      create: clothesData,
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { sourceId: 'abc123' },
      update: clothesData,
      create: clothesData,
    });
  });
});
