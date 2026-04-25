import { describe, it, expect } from 'vitest';
import {
  parseLhDate,
  flattenLhResponse,
  transformSupplyDataset,
  transformAllSupplies,
  transformAttachments,
  transformLhAnnouncement,
  buildSourceId,
  isLandAnnouncement,
  type LhAnnouncementListItem,
  type LhDetailResponse,
  type LhSupplyResponse,
} from '../../src/utils/lhAnnouncementTransform.js';

describe('parseLhDate', () => {
  it('parses YYYYMMDD format', () => {
    const date = parseLhDate('20260424');
    expect(date).not.toBeNull();
    expect(date!.getUTCFullYear()).toBe(2026);
    expect(date!.getUTCMonth()).toBe(3); // April = 3
    expect(date!.getUTCDate()).toBe(24);
  });

  it('parses YYYY.MM.DD format', () => {
    const date = parseLhDate('2026.04.24');
    expect(date).not.toBeNull();
    expect(date!.getUTCFullYear()).toBe(2026);
    expect(date!.getUTCMonth()).toBe(3);
    expect(date!.getUTCDate()).toBe(24);
  });

  it('returns null for empty string', () => {
    expect(parseLhDate('')).toBeNull();
    expect(parseLhDate('   ')).toBeNull();
  });

  it('returns null for null/undefined', () => {
    expect(parseLhDate(null)).toBeNull();
    expect(parseLhDate(undefined)).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(parseLhDate('2026-04-24')).toBeNull(); // hyphens not supported
    expect(parseLhDate('20260499')).toBeNull(); // invalid day
    expect(parseLhDate('20261324')).toBeNull(); // invalid month
    expect(parseLhDate('abcdefgh')).toBeNull();
    expect(parseLhDate('2026.4.24')).toBeNull(); // not zero-padded
  });
});

describe('buildSourceId', () => {
  it('joins panId and ccrCnntSysDsCd with dash', () => {
    expect(buildSourceId('20240001', '01')).toBe('20240001-01');
  });
});

describe('isLandAnnouncement', () => {
  it('detects 토지 in UPP_AIS_TP_NM', () => {
    expect(isLandAnnouncement({ UPP_AIS_TP_NM: '토지' })).toBe(true);
    expect(isLandAnnouncement({ UPP_AIS_TP_NM: '토지매각' })).toBe(true);
  });

  it('returns false for 임대주택 and 분양주택', () => {
    expect(isLandAnnouncement({ UPP_AIS_TP_NM: '임대주택' })).toBe(false);
    expect(isLandAnnouncement({ UPP_AIS_TP_NM: '분양주택' })).toBe(false);
    expect(isLandAnnouncement({ UPP_AIS_TP_NM: '' })).toBe(false);
  });
});

describe('transformSupplyDataset', () => {
  it('transforms dsList01 (분양) — silAmt populated', () => {
    const result = transformSupplyDataset(
      [
        {
          HTY_NM: '74A',
          RSDN_DDO_AR: 74.94,
          SPL_AR: 99.0954,
          SIL_HSH_CNT: 14,
          TOT_HSH_CNT: 14,
          SIL_AMT: 250000000,
        },
      ],
      '01'
    );
    expect(result).toHaveLength(1);
    expect(result[0].listType).toBe('01');
    expect(result[0].silAmt).toBe(250000000n);
    expect(result[0].lsGmy).toBeNull();
    expect(result[0].mmRfe).toBeNull();
    expect(result[0].elyDsuAmt).toBeNull();
    expect(result[0].rsdnDdoAr).toBe(74.94);
    expect(result[0].splAr).toBe(99.0954);
    expect(result[0].silHshCnt).toBe(14);
  });

  it('transforms dsList02 (일반 임대) — lsGmy + mmRfe populated', () => {
    const result = transformSupplyDataset(
      [
        {
          HTY_NM: '74.9400B',
          RSDN_DDO_AR: '74.94',
          SPL_AR: '99.0954',
          SIL_HSH_CNT: '14',
          TOT_HSH_CNT: '14',
          LS_GMY: '84,196,000',
          MM_RFE: '669,250',
        },
      ],
      '02'
    );
    expect(result).toHaveLength(1);
    expect(result[0].listType).toBe('02');
    expect(result[0].lsGmy).toBe(84196000n);
    expect(result[0].mmRfe).toBe(669250);
    expect(result[0].silAmt).toBeNull();
    expect(result[0].elyDsuAmt).toBeNull();
  });

  it('transforms dsList03 (분납임대) — elyDsuAmt + mmRfe populated', () => {
    const result = transformSupplyDataset(
      [
        {
          HTY_NM: '59A',
          RSDN_DDO_AR: 59.0,
          SPL_AR: 78.5,
          SIL_HSH_CNT: 30,
          TOT_HSH_CNT: 30,
          ELY_DSU_AMT: 50000000,
          MM_RFE: 300000,
        },
      ],
      '03'
    );
    expect(result).toHaveLength(1);
    expect(result[0].listType).toBe('03');
    expect(result[0].elyDsuAmt).toBe(50000000n);
    expect(result[0].mmRfe).toBe(300000);
    expect(result[0].silAmt).toBeNull();
    expect(result[0].lsGmy).toBeNull();
  });

  it('transforms dsList04 (기타 임대) — lsGmy + mmRfe populated', () => {
    const result = transformSupplyDataset(
      [{ HTY_NM: '49C', LS_GMY: 60000000, MM_RFE: 500000 }],
      '04'
    );
    expect(result).toHaveLength(1);
    expect(result[0].listType).toBe('04');
    expect(result[0].lsGmy).toBe(60000000n);
    expect(result[0].mmRfe).toBe(500000);
  });

  it('returns empty array for empty / undefined input', () => {
    expect(transformSupplyDataset(undefined, '02')).toEqual([]);
    expect(transformSupplyDataset([], '02')).toEqual([]);
  });

  it('handles missing money fields gracefully', () => {
    const result = transformSupplyDataset([{ HTY_NM: '49C' }], '02');
    expect(result).toHaveLength(1);
    expect(result[0].lsGmy).toBeNull();
    expect(result[0].mmRfe).toBeNull();
  });
});

describe('transformAllSupplies', () => {
  it('combines dsList01 + dsList02 in order', () => {
    const supply: LhSupplyResponse = {
      dsList01: [{ HTY_NM: '74A', SIL_AMT: 200000000 }],
      dsList02: [{ HTY_NM: '59B', LS_GMY: 50000000, MM_RFE: 200000 }],
    };
    const result = transformAllSupplies(supply);
    expect(result).toHaveLength(2);
    expect(result[0].listType).toBe('01');
    expect(result[1].listType).toBe('02');
  });

  it('returns empty array for undefined response', () => {
    expect(transformAllSupplies(undefined)).toEqual([]);
  });
});

describe('transformAttachments', () => {
  it('combines dsAhflInfo and dsSbdAhfl, filters empty URLs', () => {
    const detail: LhDetailResponse = {
      dsAhflInfo: [
        { AHFL_URL: 'https://example.com/a.pdf', CMN_AHFL_NM: '공고문', SL_PAN_AHFL_DS_CD_NM: '공고' },
        { AHFL_URL: '', CMN_AHFL_NM: '빈URL' },
      ],
      dsSbdAhfl: [
        { AHFL_URL: 'https://example.com/b.pdf', CMN_AHFL_NM: '단지도면' },
      ],
    };
    const result = transformAttachments(detail);
    expect(result).toHaveLength(2);
    expect(result[0].ahflUrl).toBe('https://example.com/a.pdf');
    expect(result[0].cmnAhflNm).toBe('공고문');
    expect(result[1].ahflUrl).toBe('https://example.com/b.pdf');
  });

  it('falls back cmnAhflNm to default when missing', () => {
    const detail: LhDetailResponse = {
      dsAhflInfo: [{ AHFL_URL: 'https://x.com/a.pdf' }],
    };
    const result = transformAttachments(detail);
    expect(result[0].cmnAhflNm).toBe('첨부파일');
  });

  it('returns empty array when both datasets missing', () => {
    expect(transformAttachments(undefined)).toEqual([]);
    expect(transformAttachments({})).toEqual([]);
  });
});

describe('transformLhAnnouncement', () => {
  const baseListItem: LhAnnouncementListItem = {
    PAN_ID: '2024003789',
    CCR_CNNT_SYS_DS_CD: '01',
    UPP_AIS_TP_CD: '06',
    UPP_AIS_TP_NM: '임대주택',
    AIS_TP_CD: '01',
    AIS_TP_NM: '국민임대',
    SPL_INF_TP_CD: '060',
    PAN_NM: '경기도 부천 매입임대',
    CNP_CD_NM: '경기도',
    PAN_DT: '20260315',
    CLSG_DT: '2026.04.15',
    PAN_SS: '공고중',
    DTL_URL: 'https://apply.lh.or.kr/lhapply/notice/123',
  };

  it('builds full upsert payload from list + detail + supply responses', () => {
    const detail: LhDetailResponse = {
      dsSbd: [
        {
          BZDT_NM: '부천 ABC 아파트',
          LCT_ARA_ADR: '경기도 부천시 원미로 100',
          SUM_TOT_HSH_CNT: 200,
          MVIN_XPC_YM: '2026.10',
          HTN_FMLA_DS_CD_NM: '아파트',
          EDC_FCL_CTS: '초/중/고 도보권',
          TFFC_FCL_CTS: '지하철 7호선 부천시청역',
        },
      ],
      dsSplScdl: [
        { ACP_DTTM: '2026.04.10 09:00 ~ 2026.04.12 17:00', PZWR_ANC_DT: '2026.04.20' },
      ],
      dsEtcInfo: [{ PAN_DTL_CTS: '본 공고 내용은 ...' }],
      dsCtrtPlc: [
        { CTRT_PLC_ADR: '경기도 부천시 길주로 200', SIL_OFC_TLNO: '032-123-4567' },
      ],
      dsAhflInfo: [{ AHFL_URL: 'https://lh.or.kr/files/notice.pdf', CMN_AHFL_NM: '공고문' }],
    };
    const supply: LhSupplyResponse = {
      dsList02: [{ HTY_NM: '49A', LS_GMY: 30000000, MM_RFE: 200000, SIL_HSH_CNT: 50 }],
    };

    const bundle = transformLhAnnouncement(baseListItem, detail, supply);

    expect(bundle.announcement.sourceId).toBe('2024003789-01');
    expect(bundle.announcement.panNm).toBe('경기도 부천 매입임대');
    expect(bundle.announcement.cnpNm).toBe('경기도');
    expect(bundle.announcement.panDt!.getUTCMonth()).toBe(2); // March
    expect(bundle.announcement.clsgDt!.getUTCMonth()).toBe(3); // April
    expect(bundle.announcement.bzdtNm).toBe('부천 ABC 아파트');
    expect(bundle.announcement.sumTotHshCnt).toBe(200);
    expect(bundle.announcement.acpDttm).toBe('2026.04.10 09:00 ~ 2026.04.12 17:00');
    expect(bundle.announcement.panDtlCts).toBe('본 공고 내용은 ...');
    expect(bundle.announcement.silOfcTlno).toBe('032-123-4567');
    expect(bundle.supplies).toHaveLength(1);
    expect(bundle.supplies[0].listType).toBe('02');
    expect(bundle.attachments).toHaveLength(1);
    expect(bundle.attachments[0].ahflUrl).toBe('https://lh.or.kr/files/notice.pdf');
  });

  it('handles missing detail / supply (defensive parsing)', () => {
    const bundle = transformLhAnnouncement(baseListItem, undefined, undefined);
    expect(bundle.announcement.panNm).toBe('경기도 부천 매입임대');
    expect(bundle.announcement.bzdtNm).toBeNull();
    expect(bundle.announcement.lctAraAdr).toBeNull();
    expect(bundle.announcement.acpDttm).toBeNull();
    expect(bundle.supplies).toEqual([]);
    expect(bundle.attachments).toEqual([]);
  });

  it('uses CNP_CD_NM when CNP_NM missing', () => {
    const item = { ...baseListItem, CNP_NM: undefined, CNP_CD_NM: '서울특별시' };
    const bundle = transformLhAnnouncement(item, undefined, undefined);
    expect(bundle.announcement.cnpNm).toBe('서울특별시');
  });

  it('uses AIS_TP_CD_NM when AIS_TP_NM missing (실제 LIST API 응답 형태)', () => {
    const item = { ...baseListItem, AIS_TP_NM: undefined, AIS_TP_CD_NM: '공공임대' };
    const bundle = transformLhAnnouncement(item, undefined, undefined);
    expect(bundle.announcement.aisTpNm).toBe('공공임대');
  });

  it('aisTpNm 빈 문자열 fallback (양쪽 다 missing)', () => {
    const item = { ...baseListItem, AIS_TP_NM: undefined, AIS_TP_CD_NM: undefined };
    const bundle = transformLhAnnouncement(item, undefined, undefined);
    expect(bundle.announcement.aisTpNm).toBe('');
  });
});

describe('flattenLhResponse', () => {
  it('데이터고포털 LH API 의 [{dsSch}, {dsList}] 배열 응답을 단일 객체로 머지', () => {
    const apiShape = [
      { dsSch: [{ PG_SZ: '2', PAGE: '1' }] },
      { dsList: [{ PAN_ID: '0000061073', ALL_CNT: '2730' }] },
    ];
    const merged = flattenLhResponse<{ dsList?: Array<Record<string, unknown>>; dsSch?: unknown[] }>(apiShape);
    expect(merged.dsList).toHaveLength(1);
    expect(merged.dsList?.[0].PAN_ID).toBe('0000061073');
    expect(merged.dsSch).toBeDefined();
  });

  it('SUPPLY 응답의 dsList01..04 배열 청크 머지', () => {
    const apiShape = [
      { dsSch: [{}] },
      { dsList01: [{ HTY_NM: '74A' }], dsList01Nm: [{ HTY_NM: '주택형' }] },
      { dsList02: [], dsList03: [{ HTY_NM: '49A' }], dsList04: [] },
    ];
    const merged = flattenLhResponse<{ dsList01?: unknown[]; dsList02?: unknown[]; dsList03?: unknown[]; dsList04?: unknown[] }>(apiShape);
    expect(merged.dsList01).toHaveLength(1);
    expect(merged.dsList02).toHaveLength(0);
    expect(merged.dsList03).toHaveLength(1);
    expect(merged.dsList04).toHaveLength(0);
  });

  it('객체 형태 응답 (배열 아닌 경우) 도 패스스루', () => {
    const objShape = { dsList: [{ PAN_ID: 'x' }] };
    const merged = flattenLhResponse<{ dsList?: unknown[] }>(objShape);
    expect(merged.dsList).toHaveLength(1);
  });

  it('null/undefined 입력은 빈 객체 반환', () => {
    expect(flattenLhResponse(null)).toEqual({});
    expect(flattenLhResponse(undefined)).toEqual({});
  });

  it('배열 안에 null/원시값이 섞여도 안전하게 머지', () => {
    const noisyShape = [
      null,
      { dsList: [{ a: 1 }] },
      'noise',
      { dsList02: [{ b: 2 }] },
    ];
    const merged = flattenLhResponse<{ dsList?: unknown[]; dsList02?: unknown[] }>(noisyShape);
    expect(merged.dsList).toEqual([{ a: 1 }]);
    expect(merged.dsList02).toEqual([{ b: 2 }]);
  });
});
