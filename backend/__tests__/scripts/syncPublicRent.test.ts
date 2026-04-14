import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpsert, mockFindMany } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    publicRentalComplex: { upsert: mockUpsert },
    region: { findMany: mockFindMany },
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  transformPublicRentItem,
  type PublicRentApiItem,
} from '../../src/scripts/syncPublicRent.js';

describe('transformPublicRentItem', () => {
  it('API 응답 item을 DB 필드로 변환 (기본 케이스)', () => {
    const item: PublicRentApiItem = {
      단지코드: 'LH001',
      단지명: '서울공공임대주택',
      지역본부명: '서울본부',
      지역명: '서울특별시 강남구',
      단지구분명: '영구임대',
      세대수: '500',
      동수: '10',
      준공일자: '20150320',
      입주지정기간시작일: '20150401',
      입주지정기간종료일: '20150430',
      주소: '서울특별시 강남구 테헤란로 100',
      우편번호: '06000',
    };

    const result = transformPublicRentItem(item);

    expect(result.complexCode).toBe('LH001');
    expect(result.complexName).toBe('서울공공임대주택');
    expect(result.regionHub).toBe('서울본부');
    expect(result.rentalType).toBe('영구임대');
    expect(result.householdCount).toBe(500);
    expect(result.buildingCount).toBe(10);
    expect(result.completionDate).toEqual(new Date('2015-03-20'));
    expect(result.moveInStart).toEqual(new Date('2015-04-01'));
    expect(result.moveInEnd).toEqual(new Date('2015-04-30'));
    expect(result.address).toBe('서울특별시 강남구 테헤란로 100');
    expect(result.zipCode).toBe('06000');
    expect(result.city).toBe('서울특별시');
    expect(result.district).toBe('강남구');
    expect(result.landlordAgency).toBe('LH');
  });

  it('주소에서 city/district 파싱 (2단계)', () => {
    const item: PublicRentApiItem = {
      단지코드: 'LH002',
      단지명: '부산공공임대',
      지역본부명: '부산본부',
      지역명: '부산광역시 해운대구',
      단지구분명: '국민임대',
      세대수: '300',
      동수: '5',
      준공일자: '20140101',
      입주지정기간시작일: '20140201',
      입주지정기간종료일: '20140228',
      주소: '부산광역시 해운대구 센텀로 50',
      우편번호: '48100',
    };

    const result = transformPublicRentItem(item);
    expect(result.city).toBe('부산광역시');
    expect(result.district).toBe('해운대구');
  });

  it('주소에서 city/district 파싱 실패 시 null 처리', () => {
    const item: PublicRentApiItem = {
      단지코드: 'LH003',
      단지명: '테스트단지',
      지역본부명: '테스트',
      지역명: '테스트',
      단지구분명: '행복주택',
      세대수: '100',
      동수: '2',
      준공일자: '20100101',
      입주지정기간시작일: '20100201',
      입주지정기간종료일: '20100228',
      주소: '주소정보없음',
      우편번호: '00000',
    };

    const result = transformPublicRentItem(item);
    expect(result.city).toBeNull();
    expect(result.district).toBeNull();
  });

  it('날짜 문자열 YYYYMMDD → DateTime 변환', () => {
    const item: PublicRentApiItem = {
      단지코드: 'LH004',
      단지명: '대구임대',
      지역본부명: '대구본부',
      지역명: '대구광역시 중구',
      단지구분명: '국민임대',
      세대수: '250',
      동수: '4',
      준공일자: '20201215',
      입주지정기간시작일: '20210101',
      입주지정기간종료일: '20210131',
      주소: '대구광역시 중구 동성로 100',
      우편번호: '41900',
    };

    const result = transformPublicRentItem(item);
    expect(result.completionDate).toEqual(new Date('2020-12-15'));
    expect(result.moveInStart).toEqual(new Date('2021-01-01'));
    expect(result.moveInEnd).toEqual(new Date('2021-01-31'));
  });

  it('세대수/동수 문자열 정수 변환', () => {
    const item: PublicRentApiItem = {
      단지코드: 'LH005',
      단지명: '인천임대',
      지역본부명: '인천본부',
      지역명: '인천광역시 남동구',
      단지구분명: '영구임대',
      세대수: '1200',
      동수: '30',
      준공일자: '20180601',
      입주지정기간시작일: '20180701',
      입주지정기간종료일: '20180731',
      주소: '인천광역시 남동구 청량로 200',
      우편번호: '21500',
    };

    const result = transformPublicRentItem(item);
    expect(result.householdCount).toBe(1200);
    expect(result.buildingCount).toBe(30);
    expect(typeof result.householdCount).toBe('number');
    expect(typeof result.buildingCount).toBe('number');
  });

  it('선택 필드 없을 때 null 처리', () => {
    const item: PublicRentApiItem = {
      단지코드: 'LH006',
      단지명: '최소정보단지',
      지역본부명: '',
      지역명: '',
      단지구분명: '기타',
      세대수: '0',
      동수: '0',
      준공일자: '',
      입주지정기간시작일: '',
      입주지정기간종료일: '',
      주소: '',
      우편번호: '',
    };

    const result = transformPublicRentItem(item);
    expect(result.regionHub).toBeNull();
    expect(result.householdCount).toBe(0);
    expect(result.buildingCount).toBe(0);
    expect(result.completionDate).toBeNull();
    expect(result.moveInStart).toBeNull();
    expect(result.moveInEnd).toBeNull();
    expect(result.address).toBeNull();
    expect(result.zipCode).toBeNull();
    expect(result.city).toBeNull();
    expect(result.district).toBeNull();
  });

  it('sourceId 형식 검증 (complexCode 기준)', () => {
    const item: PublicRentApiItem = {
      단지코드: 'LH-2024-001',
      단지명: 'ID테스트단지',
      지역본부명: '테스트',
      지역명: '테스트',
      단지구분명: '국민임대',
      세대수: '100',
      동수: '2',
      준공일자: '20200101',
      입주지정기간시작일: '20200201',
      입주지정기간종료일: '20200228',
      주소: '테스트주소',
      우편번호: '12345',
    };

    const result = transformPublicRentItem(item);
    expect(result.sourceId).toBe('publicRent-LH-2024-001');
  });

  it('빈 세대수/동수 문자열 0으로 처리', () => {
    const item: PublicRentApiItem = {
      단지코드: 'LH007',
      단지명: '미정보단지',
      지역본부명: '본부명',
      지역명: '지역명',
      단지구분명: '영구임대',
      세대수: '',
      동수: '',
      준공일자: '20100101',
      입주지정기간시작일: '20100201',
      입주지정기간종료일: '20100228',
      주소: '주소',
      우편번호: '00000',
    };

    const result = transformPublicRentItem(item);
    expect(result.householdCount).toBe(0);
    expect(result.buildingCount).toBe(0);
  });

  it('임대유형 그대로 저장 (매핑 없음)', () => {
    const types = ['영구임대', '국민임대', '행복주택', '기타'];

    types.forEach((type) => {
      const item: PublicRentApiItem = {
        단지코드: `LH-${type}`,
        단지명: `${type}테스트`,
        지역본부명: '테스트',
        지역명: '테스트',
        단지구분명: type,
        세대수: '100',
        동수: '2',
        준공일자: '20200101',
        입주지정기간시작일: '20200201',
        입주지정기간종료일: '20200228',
        주소: '주소',
        우편번호: '00000',
      };

      const result = transformPublicRentItem(item);
      expect(result.rentalType).toBe(type);
    });
  });

  it('landlordAgency는 항상 LH', () => {
    const item: PublicRentApiItem = {
      단지코드: 'LH008',
      단지명: 'LH확인단지',
      지역본부명: '본부',
      지역명: '지역',
      단지구분명: '영구임대',
      세대수: '100',
      동수: '2',
      준공일자: '20200101',
      입주지정기간시작일: '20200201',
      입주지정기간종료일: '20200228',
      주소: '주소',
      우편번호: '00000',
    };

    const result = transformPublicRentItem(item);
    expect(result.landlordAgency).toBe('LH');
  });
});
