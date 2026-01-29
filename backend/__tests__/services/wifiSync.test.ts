// @TASK T2.3 - 무료 와이파이 데이터 동기화 테스트
// @SPEC docs/planning/04-database-design.md#무료-와이파이

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  transformWifiData,
  WifiCSVRow,
  WifiSyncResult,
} from '../../src/scripts/syncWifi.js';

describe('wifiSync', () => {
  describe('transformWifiData', () => {
    it('should transform valid wifi CSV row to Facility format', () => {
      const row: WifiCSVRow = {
        관리번호: '1',
        설치장소명: '강남역 1번 출구',
        설치장소상세: '',
        설치시도명: '서울특별시',
        설치시군구명: '강남구',
        설치시설구분명: '지하철역',
        서비스제공사명: 'KT',
        와이파이SSID: 'Seoul_Free_WiFi',
        설치연월: '2023-01',
        소재지도로명주소: '서울특별시 강남구 강남대로 396',
        소재지지번주소: '서울시 강남구 역삼동 123',
        관리기관명: '서울시',
        관리기관전화번호: '02-1234-5678',
        WGS84위도: '37.4979',
        WGS84경도: '127.0276',
        데이터기준일자: '2024-01-01',
      };

      const result = transformWifiData(row);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('강남역 1번 출구');
      expect(result!.lat).toBe(37.4979);
      expect(result!.lng).toBe(127.0276);
      expect(result!.city).toBe('서울');
      expect(result!.district).toBe('강남구');
      expect(result!.roadAddress).toBe('서울특별시 강남구 강남대로 396');
      expect(result!.address).toBe('서울시 강남구 역삼동 123');
      expect(result!.sourceId).toBe('wifi_1');
      // Wifi 전용 필드 (flat structure)
      expect(result!.ssid).toBe('Seoul_Free_WiFi');
      expect(result!.installDate).toBe('2023-01');
      expect(result!.serviceProvider).toBe('KT');
      expect(result!.installLocation).toBe('지하철역');
      expect(result!.managementAgency).toBe('서울시');
      expect(result!.phoneNumber).toBe('02-1234-5678');
    });

    it('should extract city and district from CSV columns', () => {
      const row: WifiCSVRow = {
        관리번호: '2',
        설치장소명: '부산역',
        설치장소상세: '',
        설치시도명: '부산광역시',
        설치시군구명: '동구',
        설치시설구분명: '역사',
        서비스제공사명: 'SKT',
        와이파이SSID: 'Busan_Free_WiFi',
        설치연월: '2023-06',
        소재지도로명주소: '부산광역시 동구 중앙대로 206',
        소재지지번주소: '',
        관리기관명: '부산시',
        관리기관전화번호: '',
        WGS84위도: '35.1150',
        WGS84경도: '129.0420',
        데이터기준일자: '2024-01-01',
      };

      const result = transformWifiData(row);

      expect(result).not.toBeNull();
      expect(result!.city).toBe('부산');
      expect(result!.district).toBe('동구');
    });

    it('should return null for row with invalid coordinates', () => {
      const row: WifiCSVRow = {
        관리번호: '3',
        설치장소명: '테스트',
        설치장소상세: '',
        설치시도명: '서울특별시',
        설치시군구명: '강남구',
        설치시설구분명: '테스트',
        서비스제공사명: 'KT',
        와이파이SSID: 'Test_WiFi',
        설치연월: '2023-01',
        소재지도로명주소: '서울시 강남구 테스트로 1',
        소재지지번주소: '',
        관리기관명: '테스트',
        관리기관전화번호: '',
        WGS84위도: '',
        WGS84경도: '',
        데이터기준일자: '2024-01-01',
      };

      const result = transformWifiData(row);

      expect(result).toBeNull();
    });

    it('should return null for row with missing required fields', () => {
      const row: WifiCSVRow = {
        관리번호: '4',
        설치장소명: '', // 필수 필드 누락
        설치장소상세: '',
        설치시도명: '',
        설치시군구명: '',
        설치시설구분명: '',
        서비스제공사명: '',
        와이파이SSID: '',
        설치연월: '',
        소재지도로명주소: '',
        소재지지번주소: '',
        관리기관명: '',
        관리기관전화번호: '',
        WGS84위도: '37.5',
        WGS84경도: '127.0',
        데이터기준일자: '',
      };

      const result = transformWifiData(row);

      expect(result).toBeNull();
    });

    it('should handle various city name formats', () => {
      const testCases = [
        { cityName: '서울특별시', districtName: '송파구', expectedCity: '서울', expectedDistrict: '송파구' },
        { cityName: '경기도', districtName: '성남시', expectedCity: '경기', expectedDistrict: '성남시' },
        { cityName: '인천광역시', districtName: '연수구', expectedCity: '인천', expectedDistrict: '연수구' },
        { cityName: '제주특별자치도', districtName: '제주시', expectedCity: '제주', expectedDistrict: '제주시' },
        { cityName: '강원특별자치도', districtName: '춘천시', expectedCity: '강원', expectedDistrict: '춘천시' },
        { cityName: '세종특별자치시', districtName: '세종시', expectedCity: '세종', expectedDistrict: '세종시' },
      ];

      testCases.forEach(({ cityName, districtName, expectedCity, expectedDistrict }) => {
        const row: WifiCSVRow = {
          관리번호: '1',
          설치장소명: '테스트 장소',
          설치장소상세: '',
          설치시도명: cityName,
          설치시군구명: districtName,
          설치시설구분명: '테스트',
          서비스제공사명: 'KT',
          와이파이SSID: 'Test_WiFi',
          설치연월: '2023-01',
          소재지도로명주소: '',
          소재지지번주소: '',
          관리기관명: '테스트',
          관리기관전화번호: '',
          WGS84위도: '37.5',
          WGS84경도: '127.0',
          데이터기준일자: '2024-01-01',
        };

        const result = transformWifiData(row);

        expect(result).not.toBeNull();
        expect(result!.city).toBe(expectedCity);
        expect(result!.district).toBe(expectedDistrict);
      });
    });

    it('should generate unique ID from row number and SSID', () => {
      const row: WifiCSVRow = {
        관리번호: '123',
        설치장소명: '테스트 장소',
        설치장소상세: '',
        설치시도명: '서울특별시',
        설치시군구명: '강남구',
        설치시설구분명: '테스트',
        서비스제공사명: 'KT',
        와이파이SSID: 'Test_WiFi',
        설치연월: '2023-01',
        소재지도로명주소: '서울시 강남구 테스트로 1',
        소재지지번주소: '',
        관리기관명: '테스트',
        관리기관전화번호: '',
        WGS84위도: '37.5',
        WGS84경도: '127.0',
        데이터기준일자: '2024-01-01',
      };

      const result = transformWifiData(row);

      expect(result).not.toBeNull();
      expect(result!.sourceId).toBe('wifi_123');
      expect(result!.id).toMatch(/^wifi-/);
    });

    it('should handle coordinates with leading/trailing spaces', () => {
      const row: WifiCSVRow = {
        관리번호: '1',
        설치장소명: '테스트',
        설치장소상세: '',
        설치시도명: '서울특별시',
        설치시군구명: '강남구',
        설치시설구분명: '테스트',
        서비스제공사명: 'KT',
        와이파이SSID: 'Test_WiFi',
        설치연월: '2023-01',
        소재지도로명주소: '서울시 강남구 테스트로 1',
        소재지지번주소: '',
        관리기관명: '테스트',
        관리기관전화번호: '',
        WGS84위도: ' 37.4979 ',
        WGS84경도: ' 127.0276 ',
        데이터기준일자: '2024-01-01',
      };

      const result = transformWifiData(row);

      expect(result).not.toBeNull();
      expect(result!.lat).toBe(37.4979);
      expect(result!.lng).toBe(127.0276);
    });
  });

  describe('parseAddress', () => {
    // parseAddress 함수가 내부에서 사용되므로 transformWifiData를 통해 간접 테스트
    it('should fallback to unknown for empty city/district columns', () => {
      const row: WifiCSVRow = {
        관리번호: '1',
        설치장소명: '테스트 장소',
        설치장소상세: '',
        설치시도명: '', // 빈 값
        설치시군구명: '', // 빈 값
        설치시설구분명: '테스트',
        서비스제공사명: 'KT',
        와이파이SSID: 'Test_WiFi',
        설치연월: '2023-01',
        소재지도로명주소: '알 수 없는 주소 형식',
        소재지지번주소: '알 수 없는 주소',
        관리기관명: '테스트',
        관리기관전화번호: '',
        WGS84위도: '37.5',
        WGS84경도: '127.0',
        데이터기준일자: '2024-01-01',
      };

      const result = transformWifiData(row);

      expect(result).not.toBeNull();
      expect(result!.city).toBe('unknown');
      expect(result!.district).toBe('unknown');
    });
  });
});
