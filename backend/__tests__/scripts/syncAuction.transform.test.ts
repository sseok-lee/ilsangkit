// backend/__tests__/scripts/syncAuction.transform.test.ts
import { describe, it, expect } from 'vitest';
import { transformAuctionItem, type RawAuctionItem } from '../../src/scripts/syncAuction.js';

const base: RawAuctionItem = {
  cltrMngNo: '6012880',
  pbctCdtnNo: '0001',
  plnmNo: '2026-0400-021484',
  cltrNm: '서울특별시 강남구 역삼동 123 ABC빌딩 101호',
  ctgrFullNm: '오피스텔',
  prptDivNm: '압류재산',
  dpslMtdNm: '매각',
  apslAssAmt: '300000000',
  minBidPrc: '210000000',
  pbctBegnDtm: '202601011100',
  pbctClsDtm: '202612011600',
  fbdrCnt: '2',
  pbctSno: '7',
  orgNm: '한국자산관리공사',
  ldCd: '1168010100',
  city: '서울특별시',
  district: '강남구',
};

describe('transformAuctionItem', () => {
  it('핵심 필드 매핑 + usageGroup + sourceId + 원단위 BigInt', () => {
    const r = transformAuctionItem(base)!;
    expect(r.cltrMngNo).toBe('6012880');
    expect(r.pbctCdtnNo).toBe('0001');
    expect(r.usageGroup).toBe('residential');
    expect(r.apslAssAmt).toBe(300000000n);
    expect(r.minBidPrc).toBe(210000000n);
    expect(r.failCnt).toBe(2);
    expect(r.bidRound).toBe(7);
    expect(r.sourceId).toBe('auction-6012880');
    expect(r.status).toBe('ongoing'); // 미래 마감일 → 진행/예정
    expect(r.bjdCode).toBe('11680'); // ldCd 앞 5자리(시군구)
  });
  it('입찰일시 파싱(YYYYMMDDhhmm → Date)', () => {
    const r = transformAuctionItem(base)!;
    expect(r.bidCloseDtm?.getUTCFullYear()).toBe(2026);
    expect(r.bidCloseDtm?.getUTCMonth()).toBe(11); // 12월
  });
  it('입찰 시작 전이면 scheduled(예정)', () => {
    const r = transformAuctionItem({ ...base, pbctBegnDtm: '202612011100', pbctClsDtm: '202612021600' })!;
    expect(r.status).toBe('scheduled');
  });
  it('입찰 종료 후면 closed', () => {
    const r = transformAuctionItem({ ...base, pbctBegnDtm: '202501011100', pbctClsDtm: '202502011600' })!;
    expect(r.status).toBe('closed');
  });
  it('빈 금액/누락 필드는 null', () => {
    const r = transformAuctionItem({ ...base, apslAssAmt: ' ', minBidPrc: '' })!;
    expect(r.apslAssAmt).toBeNull();
    expect(r.minBidPrc).toBeNull();
  });
  it('필수 식별자(cltrMngNo) 없으면 null 반환(스킵)', () => {
    expect(transformAuctionItem({ ...base, cltrMngNo: '' })).toBeNull();
  });
});
