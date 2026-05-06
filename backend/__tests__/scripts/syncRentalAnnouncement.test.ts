import { describe, it, expect } from 'vitest';
import {
  normalizeDate,
  transformAnnouncement,
  extractItems,
  type AnnouncementApiItem,
} from '../../src/scripts/syncRentalAnnouncement.js';

describe('normalizeDate', () => {
  it('YYYYMMDD 8자리 숫자를 YYYY-MM-DD로 정규화한다', () => {
    expect(normalizeDate('20260601')).toBe('2026-06-01');
  });

  it('YYYY-MM-DD 는 그대로 둔다', () => {
    expect(normalizeDate('2026-06-01')).toBe('2026-06-01');
  });

  it('빈 문자열/null/undefined는 null 을 반환한다', () => {
    expect(normalizeDate('')).toBeNull();
    expect(normalizeDate(null)).toBeNull();
    expect(normalizeDate(undefined)).toBeNull();
  });

  it('공백을 trim 한다', () => {
    expect(normalizeDate('  20260601  ')).toBe('2026-06-01');
  });

  it('잘못된 형식은 null 을 반환한다', () => {
    expect(normalizeDate('2026/06/01')).toBeNull();
    expect(normalizeDate('not-a-date')).toBeNull();
  });
});

describe('extractItems — 마이홈 응답 envelope', () => {
  it('실 응답: response.body.item (단수, 배열) 을 items 로 추출한다', () => {
    const env = {
      response: {
        header: { resultCode: '00' },
        body: {
          totalCount: '390',
          numOfRows: '2',
          pageNo: '1',
          item: [
            { pblancId: '20221', pblancNm: '오산세교 모집' },
            { pblancId: '20222', pblancNm: '인천검단 모집' },
          ] as AnnouncementApiItem[],
        },
      },
    };
    const out = extractItems(env);
    expect(out.totalCount).toBe(390);
    expect(out.items.length).toBe(2);
    expect(out.items[0].pblancId).toBe('20221');
  });

  it('단일 객체 item 도 배열로 변환한다', () => {
    const env = {
      response: {
        body: {
          totalCount: '1',
          item: { pblancId: '1', pblancNm: '단일' } as AnnouncementApiItem,
        },
      },
    };
    const out = extractItems(env);
    expect(out.items.length).toBe(1);
    expect(out.totalCount).toBe(1);
  });

  it('totalCount 가 number 형태로 와도 처리한다', () => {
    const env = { response: { body: { totalCount: 5, item: [] } } };
    expect(extractItems(env).totalCount).toBe(5);
  });

  it('item 이 없거나 body 없으면 빈 배열 + 0', () => {
    expect(extractItems({}).items).toEqual([]);
    expect(extractItems({ response: { body: {} } }).totalCount).toBe(0);
  });
});

describe('transformAnnouncement — 공통 필드 매핑', () => {
  const base: AnnouncementApiItem = {
    pblancId: '20221',
    houseSn: 6,
    pblancNm: '오산시 지역 국민임대 입주자모집',
    sttusNm: '일반공고',
    suplyInsttNm: 'LH',
    suplyTyNm: '국민임대',
    houseTyNm: '아파트',
    brtcNm: '경기도',
    signguNm: '오산시',
    hsmpNm: '오산세교16',
    fullAdres: '경기도 오산시 내삼미로 109',
    pnu: '4137011000108970000',
    rcritPblancDe: '20260506',
    przwnerPresnatnDe: '20260820',
    beginDe: '20260518',
    endDe: '20260520',
    totHshldCo: 822,
    sumSuplyCo: 60,
    rentGtn: 16242000,
    enty: 810000,
    prtpay: 0,
    surlus: 15432000,
    mtRntchrg: 225660,
    heatMthdNm: '지역난방',
    refrnc: 'LH 콜센터 : 1600-1004',
    url: 'https://apply.lh.or.kr/...',
    pcUrl: 'https://www.myhome.go.kr/...',
    mobileUrl: 'https://m.myhome.go.kr/...',
  };

  it('일반 모집공고는 source=general 으로 변환된다', () => {
    const r = transformAnnouncement(base, 'general');
    expect(r.source).toBe('general');
    expect(r.pblancId).toBe('20221');
    expect(r.houseSn).toBe(6);
  });

  it('장기임대 모집공고는 source=longTerm 으로 변환된다', () => {
    const r = transformAnnouncement(base, 'longTerm');
    expect(r.source).toBe('longTerm');
  });

  it('beginDe/endDe/rcritPblancDe/przwnerDe 는 YYYY-MM-DD 로 정규화된다', () => {
    const r = transformAnnouncement(base, 'general');
    expect(r.beginDe).toBe('2026-05-18');
    expect(r.endDe).toBe('2026-05-20');
    expect(r.rcritPblancDe).toBe('2026-05-06');
    expect(r.przwnerDe).toBe('2026-08-20');
  });

  it('금액 필드는 BigInt 로 변환된다 (보증금/계약금/중도금/잔금)', () => {
    const r = transformAnnouncement(base, 'general');
    expect(r.rentGtn).toBe(16242000n);
    expect(r.enty).toBe(810000n);
    expect(r.prtpay).toBe(0n);
    expect(r.surlus).toBe(15432000n);
    expect(r.mtRntchrg).toBe(225660); // Int
  });

  it('rawJson 에 원본 항목이 보존된다', () => {
    const r = transformAnnouncement(base, 'general');
    expect(r.rawJson).toEqual(base);
  });

  it('houseSn 누락 시 기본값 1 로 폴백', () => {
    const r = transformAnnouncement({ ...base, houseSn: null }, 'general');
    expect(r.houseSn).toBe(1);
  });
});

describe('transformAnnouncement — null/빈 값 처리', () => {
  it('필수 외 필드가 비어 있으면 null 로 저장된다', () => {
    const item: AnnouncementApiItem = {
      pblancId: 'PB-X',
      pblancNm: '제목만 있음',
    };
    const r = transformAnnouncement(item, 'general');
    expect(r.suplyInsttNm).toBeNull();
    expect(r.suplyTyNm).toBeNull();
    expect(r.houseTyNm).toBeNull();
    expect(r.brtcNm).toBeNull();
    expect(r.signguNm).toBeNull();
    expect(r.hsmpNm).toBeNull();
    expect(r.pnu).toBeNull();
    expect(r.beginDe).toBeNull();
    expect(r.endDe).toBeNull();
    expect(r.rentGtn).toBeNull();
    expect(r.url).toBeNull();
  });

  it('숫자 필드가 문자열로 와도 변환한다', () => {
    const item: AnnouncementApiItem = {
      pblancId: 'PB-Y',
      pblancNm: '문자열 숫자',
      sumSuplyCo: '250' as unknown as number,
      rentGtn: '50000000' as unknown as number,
    };
    const r = transformAnnouncement(item, 'general');
    expect(r.sumSuplyCo).toBe(250);
    expect(r.rentGtn).toBe(50000000n);
  });

  it('비숫자 문자열이면 null 로 처리한다', () => {
    const item: AnnouncementApiItem = {
      pblancId: 'PB-Z',
      pblancNm: '숫자 아님',
      sumSuplyCo: '미정' as unknown as number,
    };
    const r = transformAnnouncement(item, 'general');
    expect(r.sumSuplyCo).toBeNull();
  });
});
