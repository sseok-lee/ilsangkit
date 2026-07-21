import { describe, it, expect } from 'vitest';
import { JNGJ_CITY } from '../../src/lib/normalizeRegionName.js';
import { extractCityDistrict, normalizeCity } from '../../src/lib/addressParser.js';
import {
  transformToiletRow,
  transformClothesRow,
  type ToiletCSVRow,
  type ClothesCSVRow,
} from '../../src/services/csvParser.js';
import { resolveSchoolRegion } from '../../src/scripts/syncSchoolNeis.js';
import { transformChildcareItem } from '../../src/services/childcareSyncService.js';
import { transformEvChargerItem } from '../../src/services/evChargerSyncService.js';
import { transformSportsItem } from '../../src/services/sportsSyncService.js';
import {
  transformSubwayRow,
  createTransformContext,
  type SubwayCsvRow,
} from '../../src/services/subwayDataSource.js';
import { transformTrashData, type TrashApiResponse } from '../../src/scripts/syncTrash.js';

/**
 * Task A2 회귀 방지: 옛 지역명(광주/전남 변종)을 주는 모든 시설 수집 소스가
 * city 저장 직전 normalizeRegionName을 거쳐 전남광주통합특별시로 정규화되는지 검증.
 * 경기도 광주시는 절대 오염되지 않아야 한다.
 */

function toiletRow(roadAddress: string): ToiletCSVRow {
  return {
    '화장실명': '테스트화장실',
    '소재지도로명주소': roadAddress,
    '소재지지번주소': '',
    'WGS84위도': '35.1500',
    'WGS84경도': '126.9100',
    '개방시간상세': '',
  } as ToiletCSVRow;
}

describe('Task A2 — 시설 수집 소스 지역 정규화 (재드리프트 방지)', () => {
  // (a) toilet transform (parseAddress 기반 CSV 경로)
  it('(a) transformToiletRow: 전라남도 → JNGJ, district 유지', () => {
    const t = transformToiletRow(toiletRow('전라남도 영광군 영광읍 중앙로 100'));
    expect(t).not.toBeNull();
    expect(t!.city).toBe(JNGJ_CITY);
    expect(t!.district).toBe('영광군');
  });

  it('transformClothesRow: 광주광역시(필드 기반 CSV) → JNGJ', () => {
    const row = {
      mngNo: 'M1',
      instlPlcNm: '의류함1',
      ctpvNm: '광주광역시',
      sggNm: '북구',
      lctnRoadNmAddr: '광주광역시 북구 우치로 77',
      lctnLotnoAddr: '',
      lat: '35.1800',
      lot: '126.9100',
    } as ClothesCSVRow;
    const c = transformClothesRow(row);
    expect(c).not.toBeNull();
    expect(c!.city).toBe(JNGJ_CITY);
    expect(c!.district).toBe('북구');
  });

  // (b) extractCityDistrict 경로 (Aed 등)
  it('(b) extractCityDistrict: 광주광역시 서구 → JNGJ', () => {
    expect(extractCityDistrict('광주광역시 서구 만호로 123')).toEqual({
      city: JNGJ_CITY,
      district: '서구',
    });
  });

  // (c) normalizeCity 경로 (Hospital 등)
  it('(c) normalizeCity: 전남광주/광주광역시 → JNGJ', () => {
    expect(normalizeCity('전남광주')).toBe(JNGJ_CITY);
    expect(normalizeCity('광주광역시')).toBe(JNGJ_CITY);
    expect(normalizeCity('전라남도')).toBe(JNGJ_CITY);
  });

  // (d) syncSchoolNeis (NEIS 실소스)
  it('(d) resolveSchoolRegion(NEIS): 광주광역시 → JNGJ', () => {
    expect(resolveSchoolRegion('광주광역시 북구 우치로 77')).toEqual({
      city: JNGJ_CITY,
      district: '북구',
    });
  });

  // 비-CSV sync 소스 (자체 로컬 parseAddress)
  it('transformChildcareItem: 광주광역시 → JNGJ', () => {
    const item = transformChildcareItem({
      stcode: 'S1',
      crname: '테스트어린이집',
      craddr: '광주광역시 북구 우치로 77',
    });
    expect(item).not.toBeNull();
    expect(item!.city).toBe(JNGJ_CITY);
    expect(item!.district).toBe('북구');
  });

  it('transformEvChargerItem: 전라남도 → JNGJ', () => {
    const item = transformEvChargerItem({
      statId: 'ST1',
      chgerId: '01',
      statNm: '테스트충전소',
      addr: '전라남도 영광군 영광읍 중앙로 100',
    });
    expect(item).not.toBeNull();
    expect(item!.city).toBe(JNGJ_CITY);
    expect(item!.district).toBe('영광군');
  });

  it('transformSportsItem: 광주광역시(필드 기반) → JNGJ', () => {
    const item = transformSportsItem({
      faci_nm: '테스트체육관',
      addr_ctpv_nm: '광주광역시',
      addr_cpb_nm: '서구',
      faci_road_addr: '광주광역시 서구 상무대로 1',
    });
    expect(item).not.toBeNull();
    expect(item!.city).toBe(JNGJ_CITY);
    expect(item!.district).toBe('서구');
  });

  it('transformSubwayRow: 광주광역시 → JNGJ', () => {
    const row = {
      '역번호': '101',
      '역사명': '금남로4가',
      '노선번호': 'G1',
      '노선명': '광주1호선',
      '영문역사명': 'Geumnamno 4-ga',
      '한자역사명': '',
      '환승역구분': '',
      '환승노선번호': '',
      '환승노선명': '',
      '역위도': '35.1500',
      '역경도': '126.9100',
      '운영기관명': '광주교통공사',
      '역사도로명주소': '광주광역시 동구 금남로 100',
      '역사전화번호': '',
      '데이터기준일자': '',
    } as SubwayCsvRow;
    const t = transformSubwayRow(row, createTransformContext());
    expect(t).not.toBeNull();
    expect(t!.city).toBe(JNGJ_CITY);
    expect(t!.district).toBe('동구');
  });

  it('transformTrashData(WasteSchedule): 광주광역시 → JNGJ, 풀네임 컨벤션 유지', () => {
    const t = transformTrashData({
      CTPV_NM: '광주광역시',
      SGG_NM: '북구',
      MNG_NO: 'TR1',
    } as TrashApiResponse);
    expect(t).not.toBeNull();
    expect(t!.city).toBe(JNGJ_CITY);
    expect(t!.district).toBe('북구');
  });

  // (e) 경기도 광주시 오염 금지 (전 경로)
  describe('(e) 경기도 광주시 불변 (오염 금지)', () => {
    it('transformToiletRow: 경기도 광주시 유지', () => {
      const t = transformToiletRow(toiletRow('경기도 광주시 경안동 1'));
      expect(t).not.toBeNull();
      expect(t!.city).toBe('경기');
      expect(t!.district).toBe('광주시');
    });
    it('extractCityDistrict: 경기도 광주시 유지', () => {
      expect(extractCityDistrict('경기도 광주시 경안동 1')).toEqual({
        city: '경기도',
        district: '광주시',
      });
    });
    it('normalizeCity: 경기도 유지', () => {
      expect(normalizeCity('경기도')).toBe('경기');
    });
    it('resolveSchoolRegion: 경기도 광주시 유지', () => {
      expect(resolveSchoolRegion('경기도 광주시 경안동 1')).toEqual({
        city: '경기',
        district: '광주시',
      });
    });
    it('transformTrashData: 경기도 광주시 유지 (풀네임)', () => {
      const t = transformTrashData({
        CTPV_NM: '경기도',
        SGG_NM: '광주시',
        MNG_NO: 'TR2',
      } as TrashApiResponse);
      expect(t).not.toBeNull();
      expect(t!.city).toBe('경기도');
      expect(t!.district).toBe('광주시');
    });
  });

  // 무관 지역 회귀 가드 (광주/전남과 무관한 케이스는 불변)
  describe('무관 지역 불변 (회귀 가드)', () => {
    it('extractCityDistrict: 서울특별시 강남구 유지', () => {
      expect(extractCityDistrict('서울특별시 강남구 테헤란로 1')).toEqual({
        city: '서울특별시',
        district: '강남구',
      });
    });
    it('normalizeCity: 서울특별시 → 서울', () => {
      expect(normalizeCity('서울특별시')).toBe('서울');
      expect(normalizeCity('부산광역시')).toBe('부산');
    });
    it('transformToiletRow: 서울 유지', () => {
      const t = transformToiletRow(toiletRow('서울특별시 강남구 테헤란로 1'));
      expect(t).not.toBeNull();
      expect(t!.city).toBe('서울');
      expect(t!.district).toBe('강남구');
    });
  });
});
