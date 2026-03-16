import { describe, it, expect } from 'vitest';
import {
  transformSportsItem,
  type SportsAPIItem,
} from '../../src/services/sportsSyncService.js';

describe('transformSportsItem', () => {
  const baseItem: SportsAPIItem = {
    faci_nm: '한강공원 축구장',
    faci_gb_nm: '공공',
    fcob_nm: '축구장',
    ftype_nm: '운동장',
    fmng_cp_nm: '서울특별시',
    fmng_cpb_nm: '영등포구',
    faci_road_addr: '서울특별시 영등포구 여의동로 330',
    faci_lat: '37.5251',
    faci_lot: '126.9314',
    faci_gfa: '3500.5',
    stand_cpt_psn_cnt: '200',
    faci_homepage: 'https://example.com',
    faci_stat_cd: '00',
    addr_ctpv_nm: '서울특별시',
    addr_cpb_nm: '영등포구',
    addr_emd_nm: '여의도동',
    nation_yn: 'N',
    fmng_type_gb_nm: '지방자치단체',
    del_yn: 'N',
    row_num: '1',
  };

  it('should transform item with correct field mapping', () => {
    const result = transformSportsItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.name).toBe('한강공원 축구장');
    expect(result!.faciGbNm).toBe('공공');
    expect(result!.fcobNm).toBe('축구장');
    expect(result!.ftypeNm).toBe('운동장');
    expect(result!.fmngCpNm).toBe('서울특별시');
    expect(result!.fmngCpbNm).toBe('영등포구');
    expect(result!.faciHomepage).toBe('https://example.com');
    expect(result!.faciStatCd).toBe('00');
    expect(result!.addrEmdNm).toBe('여의도동');
    expect(result!.nationYn).toBe('N');
    expect(result!.fmngTypeGbNm).toBe('지방자치단체');
    expect(result!.delYn).toBe('N');
    expect(result!.rowNum).toBe(1);
  });

  it('should generate sourceId as MD5(faci_nm + faci_road_addr)', () => {
    const result = transformSportsItem(baseItem);

    expect(result).not.toBeNull();
    // sourceId should be a 16-char hex string
    expect(result!.sourceId).toMatch(/^[a-f0-9]{16}$/);
    expect(result!.id).toBe(`sports-${result!.sourceId}`);
  });

  it('should derive same sourceId for same faci_nm + faci_road_addr', () => {
    const result1 = transformSportsItem(baseItem);
    const result2 = transformSportsItem({ ...baseItem, faci_lot: '126.9999' }); // different coord, same name+addr

    expect(result1).not.toBeNull();
    expect(result2).not.toBeNull();
    expect(result1!.sourceId).toBe(result2!.sourceId);
  });

  it('should extract city and district from addr_ctpv_nm and addr_cpb_nm', () => {
    const result = transformSportsItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.city).toBe('서울'); // 서울특별시 → 서울 (CITY_NAME_MAP)
    expect(result!.district).toBe('영등포구');
    expect(result!.addrCtpvNm).toBe('서울특별시'); // raw value preserved
    expect(result!.addrCpbNm).toBe('영등포구');
  });

  it('should validate coordinates within KOREA_BOUNDS', () => {
    const result = transformSportsItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(37.5251, 4);
    expect(result!.lng).toBeCloseTo(126.9314, 4);
  });

  it('should return null lat/lng for coordinates outside KOREA_BOUNDS', () => {
    const item: SportsAPIItem = {
      ...baseItem,
      faci_lat: '10.0',
      faci_lot: '100.0',
    };

    const result = transformSportsItem(item);
    expect(result).not.toBeNull();
    expect(result!.lat).toBeNull();
    expect(result!.lng).toBeNull();
  });

  it('should return null lat/lng for missing coordinates', () => {
    const item: SportsAPIItem = {
      ...baseItem,
      faci_lat: '',
      faci_lot: '',
    };

    const result = transformSportsItem(item);
    expect(result).not.toBeNull();
    expect(result!.lat).toBeNull();
    expect(result!.lng).toBeNull();
  });

  it('should convert faci_gfa (float) and stand_cpt_psn_cnt (int) correctly', () => {
    const result = transformSportsItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.faciGfa).toBeCloseTo(3500.5, 1);
    expect(result!.standCptPsnCnt).toBe(200);
  });

  it('should handle numeric values for faci_gfa and stand_cpt_psn_cnt', () => {
    const item: SportsAPIItem = {
      ...baseItem,
      faci_gfa: 5000,
      stand_cpt_psn_cnt: 500,
    };

    const result = transformSportsItem(item);
    expect(result).not.toBeNull();
    expect(result!.faciGfa).toBe(5000);
    expect(result!.standCptPsnCnt).toBe(500);
  });

  it('should return null for faci_gfa and stand_cpt_psn_cnt when empty', () => {
    const item: SportsAPIItem = {
      ...baseItem,
      faci_gfa: '',
      stand_cpt_psn_cnt: '',
    };

    const result = transformSportsItem(item);
    expect(result).not.toBeNull();
    expect(result!.faciGfa).toBeNull();
    expect(result!.standCptPsnCnt).toBeNull();
  });

  it('should return null when del_yn is Y', () => {
    const item: SportsAPIItem = {
      ...baseItem,
      del_yn: 'Y',
    };

    const result = transformSportsItem(item);
    expect(result).toBeNull();
  });

  it('should return null when faci_nm is missing', () => {
    const item: SportsAPIItem = {
      ...baseItem,
      faci_nm: '',
    };

    const result = transformSportsItem(item);
    expect(result).toBeNull();
  });

  it('should return null when addr_ctpv_nm is missing', () => {
    const item: SportsAPIItem = {
      ...baseItem,
      addr_ctpv_nm: '',
    };

    const result = transformSportsItem(item);
    expect(result).toBeNull();
  });

  it('should return null when addr_cpb_nm is missing', () => {
    const item: SportsAPIItem = {
      ...baseItem,
      addr_cpb_nm: '',
    };

    const result = transformSportsItem(item);
    expect(result).toBeNull();
  });

  it('should handle empty strings as null for optional fields', () => {
    const item: SportsAPIItem = {
      ...baseItem,
      faci_homepage: '',
      fcob_nm: '',
      addr_emd_nm: '',
    };

    const result = transformSportsItem(item);
    expect(result).not.toBeNull();
    expect(result!.faciHomepage).toBeNull();
    expect(result!.fcobNm).toBeNull();
    expect(result!.addrEmdNm).toBeNull();
  });

  it('should normalize city name for various city formats', () => {
    const item: SportsAPIItem = {
      ...baseItem,
      addr_ctpv_nm: '경기도',
      addr_cpb_nm: '수원시',
    };

    const result = transformSportsItem(item);
    expect(result).not.toBeNull();
    expect(result!.city).toBe('경기'); // 경기도 → 경기
    expect(result!.addrCtpvNm).toBe('경기도'); // raw value preserved
  });
});
