// @TASK T9.1.2 - 공영주차장 데이터 동기화 테스트 (CSV 기반)
// @SPEC docs/planning/09-new-categories-tasks.md#T9.1.2

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseParkingCSV, transformParkingRow, ParkingCSVRow } from '../../src/services/csvParser';
import { createSyncHistory, updateSyncHistory } from '../../src/services/parkingSyncService';
import { prisma } from '../../src/lib/prisma';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';

// Mock Prisma
vi.mock('../../src/lib/prisma', () => ({
  prisma: {
    parking: {
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
        parking: {
          upsert: vi.fn().mockResolvedValue({}),
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };
      return callback(tx);
    }),
  },
}));

describe('CSV Parser - parseParkingCSV', () => {
  const sampleCSVPath = path.join(__dirname, '../fixtures/sample-parking.csv');

  beforeEach(() => {
    const fixtureDir = path.join(__dirname, '../fixtures');
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }

    // UTF-8 sample CSV
    const csvContent = `주차장관리번호,주차장명,주차장구분,주차장유형,소재지도로명주소,소재지지번주소,주차구획수,운영요일,평일운영시작시각,평일운영종료시각,토요일운영시작시각,토요일운영종료시각,공휴일운영시작시각,공휴일운영종료시각,요금정보,주차기본시간,주차기본요금,추가단위시간,추가단위요금,1일주차권요금,월정기권요금,결제방법,특기사항,장애인전용주차구역보유여부,전화번호,위도,경도,관리기관명
P-001,테스트주차장,공영,노외,서울특별시 강남구 테헤란로 123,서울특별시 강남구 역삼동 123,200,평일+토요일+공휴일,09:00,21:00,09:00,18:00,09:00,18:00,유료,30,1000,10,500,15000,100000,현금+카드,주말 할인 운영,Y,02-1234-5678,37.5012345,127.0367890,강남구청`;

    fs.writeFileSync(sampleCSVPath, csvContent, 'utf8');
  });

  afterEach(() => {
    if (fs.existsSync(sampleCSVPath)) {
      fs.unlinkSync(sampleCSVPath);
    }
  });

  it('should parse UTF-8 encoded CSV file correctly', async () => {
    const rows = await parseParkingCSV(sampleCSVPath);

    expect(rows).toHaveLength(1);
    expect(rows[0]['주차장관리번호']).toBe('P-001');
    expect(rows[0]['주차장명']).toBe('테스트주차장');
    expect(rows[0]['주차장구분']).toBe('공영');
    expect(rows[0]['주차장유형']).toBe('노외');
    expect(rows[0]['위도']).toBe('37.5012345');
    expect(rows[0]['경도']).toBe('127.0367890');
  });

  it('should handle empty CSV gracefully', async () => {
    const emptyCSVPath = path.join(__dirname, '../fixtures/empty-parking.csv');
    fs.writeFileSync(emptyCSVPath, '주차장관리번호,주차장명,주차장구분\n', 'utf8');

    const rows = await parseParkingCSV(emptyCSVPath);

    expect(rows).toHaveLength(0);
    fs.unlinkSync(emptyCSVPath);
  });

  it('should parse EUC-KR encoded CSV file correctly', async () => {
    const eucKrCSVPath = path.join(__dirname, '../fixtures/euckr-parking.csv');
    const csvContent = `주차장관리번호,주차장명,주차장구분,주차장유형,소재지도로명주소,소재지지번주소,주차구획수,운영요일,평일운영시작시각,평일운영종료시각,요금정보,주차기본시간,주차기본요금,추가단위시간,추가단위요금,위도,경도
P-002,부산역주차장,공영,노외,부산광역시 동구 중앙대로 206,부산광역시 동구 초량동 1191,500,평일+토요일,08:00,22:00,유료,30,500,10,200,35.1149975,129.0396538`;

    const eucKrBuffer = iconv.encode(csvContent, 'euc-kr');
    fs.writeFileSync(eucKrCSVPath, eucKrBuffer);

    const rows = await parseParkingCSV(eucKrCSVPath);

    expect(rows).toHaveLength(1);
    expect(rows[0]['주차장명']).toBe('부산역주차장');
    expect(rows[0]['소재지도로명주소']).toBe('부산광역시 동구 중앙대로 206');

    fs.unlinkSync(eucKrCSVPath);
  });
});

describe('CSV Parser - transformParkingRow', () => {
  it('should transform CSV row to Parking format with all fields', () => {
    const row: ParkingCSVRow = {
      '주차장관리번호': 'P-001',
      '주차장명': '강남역 공영주차장',
      '주차장구분': '공영',
      '주차장유형': '노외',
      '소재지도로명주소': '서울특별시 강남구 강남대로 396',
      '소재지지번주소': '서울특별시 강남구 역삼동 858',
      '주차구획수': '200',
      '운영요일': '평일+토요일+공휴일',
      '평일운영시작시각': '09:00',
      '평일운영종료시각': '21:00',
      '토요일운영시작시각': '09:00',
      '토요일운영종료시각': '18:00',
      '공휴일운영시작시각': '09:00',
      '공휴일운영종료시각': '18:00',
      '요금정보': '유료',
      '주차기본시간': '30',
      '주차기본요금': '1000',
      '추가단위시간': '10',
      '추가단위요금': '500',
      '1일주차권요금': '15000',
      '월정기권요금': '100000',
      '결제방법': '현금+카드',
      '특기사항': '주말 할인 운영',
      '장애인전용주차구역보유여부': 'Y',
      '전화번호': '02-1234-5678',
      '위도': '37.4979517',
      '경도': '127.0276188',
      '관리기관명': '강남구청',
    };

    const parking = transformParkingRow(row);

    expect(parking).not.toBeNull();
    expect(parking!.name).toBe('강남역 공영주차장');
    expect(parking!.roadAddress).toBe('서울특별시 강남구 강남대로 396');
    expect(parking!.address).toBe('서울특별시 강남구 역삼동 858');
    expect(parking!.lat).toBeCloseTo(37.4979517, 6);
    expect(parking!.lng).toBeCloseTo(127.0276188, 6);
    expect(parking!.city).toBe('서울');
    expect(parking!.district).toBe('강남구');
    // Parking 전용 필드
    expect(parking!.parkingType).toBe('공영');
    expect(parking!.lotType).toBe('노외');
    expect(parking!.capacity).toBe(200);
    expect(parking!.baseFee).toBe(1000);
    expect(parking!.baseTime).toBe(30);
    expect(parking!.additionalFee).toBe(500);
    expect(parking!.additionalTime).toBe(10);
    expect(parking!.dailyMaxFee).toBe(15000);
    expect(parking!.monthlyFee).toBe(100000);
    expect(parking!.operatingHours).toContain('평일 09:00~21:00');
    expect(parking!.operatingHours).toContain('토요일 09:00~18:00');
    expect(parking!.operatingHours).toContain('공휴일 09:00~18:00');
    expect(parking!.phone).toBe('02-1234-5678');
    expect(parking!.paymentMethod).toBe('현금+카드');
    expect(parking!.remarks).toBe('주말 할인 운영');
    expect(parking!.hasDisabledParking).toBe(true);
  });

  it('should handle free parking (no fees)', () => {
    const row: ParkingCSVRow = {
      '주차장관리번호': 'P-FREE',
      '주차장명': '무료주차장',
      '주차장구분': '공영',
      '주차장유형': '노상',
      '소재지도로명주소': '경기도 수원시 팔달구 정조로 123',
      '소재지지번주소': '',
      '주차구획수': '50',
      '운영요일': '평일',
      '평일운영시작시각': '00:00',
      '평일운영종료시각': '23:59',
      '요금정보': '무료',
      '주차기본시간': '',
      '주차기본요금': '',
      '추가단위시간': '',
      '추가단위요금': '',
      '위도': '37.2849750',
      '경도': '127.0134560',
    };

    const parking = transformParkingRow(row);

    expect(parking).not.toBeNull();
    expect(parking!.name).toBe('무료주차장');
    expect(parking!.parkingType).toBe('공영');
    expect(parking!.lotType).toBe('노상');
    expect(parking!.capacity).toBe(50);
    expect(parking!.baseFee).toBeNull();
    expect(parking!.baseTime).toBeNull();
    expect(parking!.additionalFee).toBeNull();
    expect(parking!.additionalTime).toBeNull();
    expect(parking!.dailyMaxFee).toBeNull();
    expect(parking!.monthlyFee).toBeNull();
  });

  it('should build operating hours string correctly', () => {
    const row: ParkingCSVRow = {
      '주차장관리번호': 'P-003',
      '주차장명': '운영시간 테스트',
      '주차장구분': '공영',
      '주차장유형': '노외',
      '소재지도로명주소': '서울특별시 중구 세종대로 123',
      '소재지지번주소': '',
      '주차구획수': '100',
      '운영요일': '평일+토요일',
      '평일운영시작시각': '07:00',
      '평일운영종료시각': '23:00',
      '토요일운영시작시각': '08:00',
      '토요일운영종료시각': '20:00',
      '요금정보': '유료',
      '주차기본시간': '30',
      '주차기본요금': '1000',
      '추가단위시간': '15',
      '추가단위요금': '500',
      '위도': '37.5663174',
      '경도': '126.9779692',
    };

    const parking = transformParkingRow(row);

    expect(parking).not.toBeNull();
    expect(parking!.operatingHours).toBe('평일 07:00~23:00, 토요일 08:00~20:00');
  });

  it('should normalize city names correctly', () => {
    const testCases = [
      { address: '서울특별시 강남구 테헤란로 1', expectedCity: '서울' },
      { address: '부산광역시 동구 중앙대로 1', expectedCity: '부산' },
      { address: '경기도 수원시 팔달구 정조로 1', expectedCity: '경기' },
      { address: '제주특별자치도 제주시 연동 1', expectedCity: '제주' },
      { address: '강원특별자치도 춘천시 중앙로 1', expectedCity: '강원' },
    ];

    for (const tc of testCases) {
      const row: ParkingCSVRow = {
        '주차장관리번호': 'TEST',
        '주차장명': '테스트주차장',
        '주차장구분': '공영',
        '주차장유형': '노외',
        '소재지도로명주소': tc.address,
        '소재지지번주소': '',
        '주차구획수': '10',
        '운영요일': '평일',
        '평일운영시작시각': '09:00',
        '평일운영종료시각': '18:00',
        '요금정보': '무료',
        '주차기본시간': '',
        '주차기본요금': '',
        '추가단위시간': '',
        '추가단위요금': '',
        '위도': '37.5',
        '경도': '127.0',
      };

      const parking = transformParkingRow(row);
      expect(parking).not.toBeNull();
      expect(parking!.city).toBe(tc.expectedCity);
    }
  });

  it('should generate unique sourceId from management number', () => {
    const row1: ParkingCSVRow = {
      '주차장관리번호': 'P-001',
      '주차장명': '주차장 A',
      '주차장구분': '공영',
      '주차장유형': '노외',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      '주차구획수': '100',
      '운영요일': '평일',
      '평일운영시작시각': '09:00',
      '평일운영종료시각': '18:00',
      '요금정보': '무료',
      '주차기본시간': '',
      '주차기본요금': '',
      '추가단위시간': '',
      '추가단위요금': '',
      '위도': '37.5012345',
      '경도': '127.0367890',
    };

    const row2: ParkingCSVRow = {
      '주차장관리번호': 'P-002',
      '주차장명': '주차장 B',
      '주차장구분': '공영',
      '주차장유형': '노외',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 2',
      '소재지지번주소': '',
      '주차구획수': '200',
      '운영요일': '평일',
      '평일운영시작시각': '09:00',
      '평일운영종료시각': '18:00',
      '요금정보': '무료',
      '주차기본시간': '',
      '주차기본요금': '',
      '추가단위시간': '',
      '추가단위요금': '',
      '위도': '37.5023456',
      '경도': '127.0378901',
    };

    const parking1 = transformParkingRow(row1);
    const parking2 = transformParkingRow(row2);

    expect(parking1).not.toBeNull();
    expect(parking2).not.toBeNull();
    expect(parking1!.sourceId).not.toBe(parking2!.sourceId);
  });

  it('should use jibun address when road address is empty', () => {
    const row: ParkingCSVRow = {
      '주차장관리번호': 'P-004',
      '주차장명': '지번주차장',
      '주차장구분': '공영',
      '주차장유형': '노상',
      '소재지도로명주소': '',
      '소재지지번주소': '서울특별시 강남구 역삼동 123',
      '주차구획수': '30',
      '운영요일': '평일',
      '평일운영시작시각': '09:00',
      '평일운영종료시각': '18:00',
      '요금정보': '무료',
      '주차기본시간': '',
      '주차기본요금': '',
      '추가단위시간': '',
      '추가단위요금': '',
      '위도': '37.5012345',
      '경도': '127.0367890',
    };

    const parking = transformParkingRow(row);

    expect(parking).not.toBeNull();
    expect(parking!.address).toBe('서울특별시 강남구 역삼동 123');
    expect(parking!.roadAddress).toBeNull();
    expect(parking!.city).toBe('서울');
    expect(parking!.district).toBe('강남구');
  });

  it('should return null for rows without name', () => {
    const row: ParkingCSVRow = {
      '주차장관리번호': 'P-005',
      '주차장명': '',
      '주차장구분': '공영',
      '주차장유형': '노외',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      '주차구획수': '100',
      '운영요일': '평일',
      '평일운영시작시각': '09:00',
      '평일운영종료시각': '18:00',
      '요금정보': '무료',
      '주차기본시간': '',
      '주차기본요금': '',
      '추가단위시간': '',
      '추가단위요금': '',
      '위도': '37.5',
      '경도': '127.0',
    };

    const parking = transformParkingRow(row);
    expect(parking).toBeNull();
  });

  it('should return null for rows without any address', () => {
    const row: ParkingCSVRow = {
      '주차장관리번호': 'P-006',
      '주차장명': '주소없는주차장',
      '주차장구분': '공영',
      '주차장유형': '노외',
      '소재지도로명주소': '',
      '소재지지번주소': '',
      '주차구획수': '100',
      '운영요일': '평일',
      '평일운영시작시각': '09:00',
      '평일운영종료시각': '18:00',
      '요금정보': '무료',
      '주차기본시간': '',
      '주차기본요금': '',
      '추가단위시간': '',
      '추가단위요금': '',
      '위도': '37.5',
      '경도': '127.0',
    };

    const parking = transformParkingRow(row);
    expect(parking).toBeNull();
  });

  it('should handle invalid coordinates with null lat/lng', () => {
    const row: ParkingCSVRow = {
      '주차장관리번호': 'P-007',
      '주차장명': '좌표오류주차장',
      '주차장구분': '공영',
      '주차장유형': '노외',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      '주차구획수': '100',
      '운영요일': '평일',
      '평일운영시작시각': '09:00',
      '평일운영종료시각': '18:00',
      '요금정보': '무료',
      '주차기본시간': '',
      '주차기본요금': '',
      '추가단위시간': '',
      '추가단위요금': '',
      '위도': 'invalid',
      '경도': '127.0',
    };

    const parking = transformParkingRow(row);

    expect(parking).not.toBeNull();
    expect(parking!.lat).toBeNull();
    expect(parking!.lng).toBeNull();
    expect(parking!.name).toBe('좌표오류주차장');
  });

  it('should handle zero coordinates with null lat/lng', () => {
    const row: ParkingCSVRow = {
      '주차장관리번호': 'P-008',
      '주차장명': '좌표0주차장',
      '주차장구분': '공영',
      '주차장유형': '노외',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      '주차구획수': '50',
      '운영요일': '평일',
      '평일운영시작시각': '09:00',
      '평일운영종료시각': '18:00',
      '요금정보': '무료',
      '주차기본시간': '',
      '주차기본요금': '',
      '추가단위시간': '',
      '추가단위요금': '',
      '위도': '0',
      '경도': '0',
    };

    const parking = transformParkingRow(row);

    expect(parking).not.toBeNull();
    expect(parking!.lat).toBeNull();
    expect(parking!.lng).toBeNull();
  });

  it('should set hasDisabledParking to false when not Y', () => {
    const row: ParkingCSVRow = {
      '주차장관리번호': 'P-009',
      '주차장명': '장애인구역없음주차장',
      '주차장구분': '공영',
      '주차장유형': '노외',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      '주차구획수': '100',
      '운영요일': '평일',
      '평일운영시작시각': '09:00',
      '평일운영종료시각': '18:00',
      '요금정보': '무료',
      '주차기본시간': '',
      '주차기본요금': '',
      '추가단위시간': '',
      '추가단위요금': '',
      '장애인전용주차구역보유여부': 'N',
      '위도': '37.5',
      '경도': '127.0',
    };

    const parking = transformParkingRow(row);

    expect(parking).not.toBeNull();
    expect(parking!.hasDisabledParking).toBe(false);
  });

  it('should handle missing optional fields gracefully', () => {
    const row: ParkingCSVRow = {
      '주차장관리번호': 'P-010',
      '주차장명': '최소정보주차장',
      '주차장구분': '',
      '주차장유형': '',
      '소재지도로명주소': '서울특별시 강남구 테헤란로 1',
      '소재지지번주소': '',
      '주차구획수': '',
      '운영요일': '',
      '평일운영시작시각': '',
      '평일운영종료시각': '',
      '요금정보': '',
      '주차기본시간': '',
      '주차기본요금': '',
      '추가단위시간': '',
      '추가단위요금': '',
      '위도': '37.5',
      '경도': '127.0',
    };

    const parking = transformParkingRow(row);

    expect(parking).not.toBeNull();
    expect(parking!.name).toBe('최소정보주차장');
    expect(parking!.parkingType).toBe('');
    expect(parking!.lotType).toBe('');
    expect(parking!.capacity).toBe(0);
    expect(parking!.operatingHours).toBe('');
    expect(parking!.phone).toBe('');
    expect(parking!.paymentMethod).toBe('');
    expect(parking!.remarks).toBe('');
    expect(parking!.hasDisabledParking).toBe(false);
  });
});

describe('Parking Sync Service - SyncHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create sync history record at start', async () => {
    const mockCreate = vi.mocked(prisma.syncHistory.create);
    mockCreate.mockResolvedValue({
      id: 1,
      category: 'parking',
      status: 'running',
      totalRecords: 0,
      newRecords: 0,
      updatedRecords: 0,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: null,
    });

    const result = await createSyncHistory('parking');

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        category: 'parking',
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
      category: 'parking',
      status: 'success',
      totalRecords: 15653,
      newRecords: 15000,
      updatedRecords: 653,
      errorMessage: null,
      startedAt: new Date(),
      completedAt: new Date(),
    });

    const result = await updateSyncHistory(1, {
      status: 'success',
      totalRecords: 15653,
      newRecords: 15000,
      updatedRecords: 653,
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: 'success',
        totalRecords: 15653,
        completedAt: expect.any(Date),
      }),
    });
    expect(result.status).toBe('success');
  });

  it('should update sync history on failure', async () => {
    const mockUpdate = vi.mocked(prisma.syncHistory.update);
    mockUpdate.mockResolvedValue({
      id: 1,
      category: 'parking',
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

describe('Parking Sync Service - Data Upsert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should upsert parking data to database', async () => {
    const mockUpsert = vi.mocked(prisma.parking.upsert);
    mockUpsert.mockResolvedValue({
      id: 'parking-abc123',
      name: '테스트주차장',
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
      // Parking 전용 필드
      parkingType: '공영',
      lotType: '노외',
      capacity: 200,
      baseFee: 1000,
      baseTime: 30,
      additionalFee: 500,
      additionalTime: 10,
      dailyMaxFee: 15000,
      monthlyFee: 100000,
      operatingHours: '평일 09:00~21:00',
      phone: '02-1234-5678',
      paymentMethod: '현금+카드',
      remarks: '주말 할인 운영',
      hasDisabledParking: true,
    });

    const parkingData = {
      id: 'parking-abc123',
      name: '테스트주차장',
      address: '서울특별시 강남구 역삼동 123',
      roadAddress: '서울특별시 강남구 테헤란로 123',
      lat: 37.5012345,
      lng: 127.0367890,
      city: '서울',
      district: '강남구',
      sourceId: 'abc123',
      parkingType: '공영',
      lotType: '노외',
      capacity: 200,
      baseFee: 1000,
      baseTime: 30,
      additionalFee: 500,
      additionalTime: 10,
      dailyMaxFee: 15000,
      monthlyFee: 100000,
      operatingHours: '평일 09:00~21:00',
      phone: '02-1234-5678',
      paymentMethod: '현금+카드',
      remarks: '주말 할인 운영',
      hasDisabledParking: true,
    };

    await prisma.parking.upsert({
      where: { sourceId: 'abc123' },
      update: parkingData,
      create: parkingData,
    });

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { sourceId: 'abc123' },
      update: parkingData,
      create: parkingData,
    });
  });
});
