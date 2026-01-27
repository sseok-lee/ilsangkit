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
        연번: '1',
        설치장소명: '강남역 1번 출구',
        소재지도로명주소: '서울특별시 강남구 강남대로 396',
        소재지지번주소: '서울시 강남구 역삼동 123',
        위도: '37.4979',
        경도: '127.0276',
        와이파이SSID: 'Seoul_Free_WiFi',
        설치년월: '2023-01',
        통신사: 'KT',
        설치환경: '지하철역',
        관리기관명: '서울시',
        관리기관전화번호: '02-1234-5678',
        데이터기준일자: '2024-01-01',
      };

      const result = transformWifiData(row);

      expect(result).not.toBeNull();
      expect(result!.name).toBe('강남역 1번 출구');
      expect(result!.category).toBe('wifi');
      expect(result!.lat).toBe(37.4979);
      expect(result!.lng).toBe(127.0276);
      expect(result!.city).toBe('서울');
      expect(result!.district).toBe('강남구');
      expect(result!.roadAddress).toBe('서울특별시 강남구 강남대로 396');
      expect(result!.address).toBe('서울시 강남구 역삼동 123');
      expect(result!.sourceId).toBe('wifi_1');
      expect(result!.details).toEqual({
        ssid: 'Seoul_Free_WiFi',
        installDate: '2023-01',
        serviceProvider: 'KT',
        installLocation: '지하철역',
        managementAgency: '서울시',
        phoneNumber: '02-1234-5678',
      });
    });

    it('should extract city and district from road address', () => {
      const row: WifiCSVRow = {
        연번: '2',
        설치장소명: '부산역',
        소재지도로명주소: '부산광역시 동구 중앙대로 206',
        소재지지번주소: '',
        위도: '35.1150',
        경도: '129.0420',
        와이파이SSID: 'Busan_Free_WiFi',
        설치년월: '2023-06',
        통신사: 'SKT',
        설치환경: '역사',
        관리기관명: '부산시',
        관리기관전화번호: '',
        데이터기준일자: '2024-01-01',
      };

      const result = transformWifiData(row);

      expect(result).not.toBeNull();
      expect(result!.city).toBe('부산');
      expect(result!.district).toBe('동구');
    });

    it('should return null for row with invalid coordinates', () => {
      const row: WifiCSVRow = {
        연번: '3',
        설치장소명: '테스트',
        소재지도로명주소: '서울시 강남구 테스트로 1',
        소재지지번주소: '',
        위도: '',
        경도: '',
        와이파이SSID: 'Test_WiFi',
        설치년월: '2023-01',
        통신사: 'KT',
        설치환경: '테스트',
        관리기관명: '테스트',
        관리기관전화번호: '',
        데이터기준일자: '2024-01-01',
      };

      const result = transformWifiData(row);

      expect(result).toBeNull();
    });

    it('should return null for row with missing required fields', () => {
      const row: WifiCSVRow = {
        연번: '4',
        설치장소명: '', // 필수 필드 누락
        소재지도로명주소: '',
        소재지지번주소: '',
        위도: '37.5',
        경도: '127.0',
        와이파이SSID: '',
        설치년월: '',
        통신사: '',
        설치환경: '',
        관리기관명: '',
        관리기관전화번호: '',
        데이터기준일자: '',
      };

      const result = transformWifiData(row);

      expect(result).toBeNull();
    });

    it('should handle various city name formats', () => {
      const testCases = [
        { address: '서울특별시 송파구 올림픽로 300', expectedCity: '서울', expectedDistrict: '송파구' },
        { address: '경기도 성남시 분당구 판교역로 235', expectedCity: '경기', expectedDistrict: '성남시' },
        { address: '인천광역시 연수구 센트럴로 350', expectedCity: '인천', expectedDistrict: '연수구' },
        { address: '제주특별자치도 제주시 중앙로 123', expectedCity: '제주', expectedDistrict: '제주시' },
        { address: '강원특별자치도 춘천시 금강로 1', expectedCity: '강원', expectedDistrict: '춘천시' },
        { address: '세종특별자치시 한누리대로 2130', expectedCity: '세종', expectedDistrict: '세종시' },
      ];

      testCases.forEach(({ address, expectedCity, expectedDistrict }) => {
        const row: WifiCSVRow = {
          연번: '1',
          설치장소명: '테스트 장소',
          소재지도로명주소: address,
          소재지지번주소: '',
          위도: '37.5',
          경도: '127.0',
          와이파이SSID: 'Test_WiFi',
          설치년월: '2023-01',
          통신사: 'KT',
          설치환경: '테스트',
          관리기관명: '테스트',
          관리기관전화번호: '',
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
        연번: '123',
        설치장소명: '테스트 장소',
        소재지도로명주소: '서울시 강남구 테스트로 1',
        소재지지번주소: '',
        위도: '37.5',
        경도: '127.0',
        와이파이SSID: 'Test_WiFi',
        설치년월: '2023-01',
        통신사: 'KT',
        설치환경: '테스트',
        관리기관명: '테스트',
        관리기관전화번호: '',
        데이터기준일자: '2024-01-01',
      };

      const result = transformWifiData(row);

      expect(result).not.toBeNull();
      expect(result!.sourceId).toBe('wifi_123');
      expect(result!.id).toMatch(/^wifi-/);
    });

    it('should handle coordinates with leading/trailing spaces', () => {
      const row: WifiCSVRow = {
        연번: '1',
        설치장소명: '테스트',
        소재지도로명주소: '서울시 강남구 테스트로 1',
        소재지지번주소: '',
        위도: ' 37.4979 ',
        경도: ' 127.0276 ',
        와이파이SSID: 'Test_WiFi',
        설치년월: '2023-01',
        통신사: 'KT',
        설치환경: '테스트',
        관리기관명: '테스트',
        관리기관전화번호: '',
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
    it('should fallback to unknown for unparseable address', () => {
      const row: WifiCSVRow = {
        연번: '1',
        설치장소명: '테스트 장소',
        소재지도로명주소: '알 수 없는 주소 형식',
        소재지지번주소: '알 수 없는 주소',
        위도: '37.5',
        경도: '127.0',
        와이파이SSID: 'Test_WiFi',
        설치년월: '2023-01',
        통신사: 'KT',
        설치환경: '테스트',
        관리기관명: '테스트',
        관리기관전화번호: '',
        데이터기준일자: '2024-01-01',
      };

      const result = transformWifiData(row);

      expect(result).not.toBeNull();
      expect(result!.city).toBe('unknown');
      expect(result!.district).toBe('unknown');
    });
  });
});
