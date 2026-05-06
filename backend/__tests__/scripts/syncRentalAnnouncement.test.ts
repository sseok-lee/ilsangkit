import { describe, it, expect } from 'vitest';
import {
  normalizeDate,
  transformAnnouncement,
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

describe('transformAnnouncement — 공통 필드 매핑', () => {
  const base: AnnouncementApiItem = {
    pblancId: 'PB-2026-001',
    pblancNo: '2026-001',
    pblancNm: '서울 매입임대 모집공고',
    suplyInsttNm: 'LH',
    suplyTyNm: '매입임대',
    brtcNm: '서울특별시',
    signguNm: '종로구',
    hsmpNm: '테스트 단지',
    pnu: '1111010100100010001',
    rcritPblancDe: '20260520',
    beginDe: '20260601',
    endDe: '20260605',
    totSplyHshldco: 100,
    url: 'https://www.myhome.go.kr/announcement/PB-2026-001',
  };

  it('일반 모집공고는 source=general 으로 변환된다', () => {
    const r = transformAnnouncement(base, 'general');
    expect(r.source).toBe('general');
    expect(r.pblancId).toBe('PB-2026-001');
    expect(r.pblancNm).toBe('서울 매입임대 모집공고');
  });

  it('장기임대 모집공고는 source=longTerm 으로 변환된다', () => {
    const r = transformAnnouncement(base, 'longTerm');
    expect(r.source).toBe('longTerm');
  });

  it('beginDe/endDe/rcritPblancDe 는 YYYY-MM-DD 문자열로 정규화된다', () => {
    const r = transformAnnouncement(base, 'general');
    expect(r.beginDe).toBe('2026-06-01');
    expect(r.endDe).toBe('2026-06-05');
    expect(r.rcritPblancDe).toBe('2026-05-20');
  });

  it('지역/공급기관/공급유형/단지명/PNU/URL/세대수를 그대로 보존한다', () => {
    const r = transformAnnouncement(base, 'general');
    expect(r.brtcNm).toBe('서울특별시');
    expect(r.signguNm).toBe('종로구');
    expect(r.suplyInsttNm).toBe('LH');
    expect(r.suplyTyNm).toBe('매입임대');
    expect(r.hsmpNm).toBe('테스트 단지');
    expect(r.pnu).toBe('1111010100100010001');
    expect(r.url).toBe('https://www.myhome.go.kr/announcement/PB-2026-001');
    expect(r.totSplyHshldco).toBe(100);
  });

  it('rawJson 에 원본 항목이 보존된다 (재처리/디버깅 용)', () => {
    const r = transformAnnouncement(base, 'general');
    expect(r.rawJson).toEqual(base);
  });
});

describe('transformAnnouncement — null/빈 값 처리', () => {
  it('필수 외 필드가 비어 있으면 null 로 저장된다', () => {
    const item: AnnouncementApiItem = {
      pblancId: 'PB-X',
      pblancNm: '제목만 있음',
    };
    const r = transformAnnouncement(item, 'general');
    expect(r.pblancNo).toBeNull();
    expect(r.suplyInsttNm).toBeNull();
    expect(r.suplyTyNm).toBeNull();
    expect(r.brtcNm).toBeNull();
    expect(r.signguNm).toBeNull();
    expect(r.hsmpNm).toBeNull();
    expect(r.pnu).toBeNull();
    expect(r.beginDe).toBeNull();
    expect(r.endDe).toBeNull();
    expect(r.totSplyHshldco).toBeNull();
    expect(r.url).toBeNull();
  });

  it('totSplyHshldco 가 문자열로 와도 number 로 변환한다', () => {
    const item: AnnouncementApiItem = {
      pblancId: 'PB-Y',
      pblancNm: '문자열 세대수',
      totSplyHshldco: '250' as unknown as number,
    };
    const r = transformAnnouncement(item, 'general');
    expect(r.totSplyHshldco).toBe(250);
  });

  it('totSplyHshldco 가 비숫자 문자열이면 null 로 처리한다', () => {
    const item: AnnouncementApiItem = {
      pblancId: 'PB-Z',
      pblancNm: '숫자 아님',
      totSplyHshldco: '미정' as unknown as number,
    };
    const r = transformAnnouncement(item, 'general');
    expect(r.totSplyHshldco).toBeNull();
  });
});
