// backend/__tests__/scripts/syncAuction.transform.test.ts
import { describe, it, expect } from 'vitest';
import { transformAuctionItem, type RawAuctionItem } from '../../src/scripts/syncAuction.js';

// 차세대 OnbidRlstListSrvc2 실제 필드명 사용 (라이브 검증 완료)
const base: RawAuctionItem = {
  cltrMngNo: '2019-02917-004',
  pbctCdtnNo: 6001661,                          // NUMBER
  onbidPbancNo: 20260400021484,                 // 공고번호 NUMBER
  onbidCltrNm: '서울특별시 강남구 역삼동 123 ABC빌딩 101호',
  cltrUsgMclsCtgrNm: '건물',                    // 용도 대분류
  cltrUsgSclsCtgrNm: '오피스텔',                // 용도 소분류
  prptDivNm: '압류재산',
  dspsMthodNm: '매각',
  landSqms: 0,
  bldSqms: 85,
  apslEvlAmt: 300000000,                        // NUMBER (감정평가금액)
  lowstBidPrcIndctCont: '210000000',            // STRING (최저입찰가)
  usbdNft: 2,                                   // 유찰횟수 NUMBER
  pbctNsq: '003',                               // 입찰회차 STRING
  cltrBidBgngDt: '202601011100',               // 입찰시작
  cltrBidEndDt: '202612011600',                // 입찰종료
  orgNm: '한국자산관리공사',
  pvctTrgtYn: 'N',
  ltnoPnu: '1168010100100230001',              // 19자리 PNU
  lctnEmdNm: '역삼동',
  lctnSdnm: '서울특별시',
  lctnSggnm: '강남구',
};

describe('transformAuctionItem (차세대 Srvc2 필드명)', () => {
  it('핵심 필드 매핑 + usageGroup + sourceId + 원단위 BigInt', () => {
    const r = transformAuctionItem(base)!;
    expect(r.cltrMngNo).toBe('2019-02917-004');
    expect(r.pbctCdtnNo).toBe('6001661');
    expect(r.address).toBe('서울특별시 강남구 역삼동 123 ABC빌딩 101호');
    expect(r.usage).toBe('건물 오피스텔');
    expect(r.usageGroup).toBe('residential');       // 오피스텔 → residential
    expect(r.apslAssAmt).toBe(300000000n);
    expect(r.minBidPrc).toBe(210000000n);
    expect(r.failCnt).toBe(2);
    expect(r.bidRound).toBe(3);                     // parseInt('003')
    expect(r.sourceId).toBe('auction-2019-02917-004');
    expect(r.bjdCode).toBe('11680');                // ltnoPnu 앞 5자리
    expect(r.dongName).toBe('역삼동');
    expect(r.pvctTrgtYn).toBe(false);               // per-item 'N'
    expect(r.propertyType).toBe('압류재산');
    expect(r.dpslMtdNm).toBe('매각');
    expect(r.orgNm).toBe('한국자산관리공사');
    expect(r.lat).toBeNull();                        // 차세대 API 미제공
    expect(r.lng).toBeNull();
  });

  it('입찰일시 파싱(YYYYMMDDhhmm → Date UTC)', () => {
    const r = transformAuctionItem(base)!;
    expect(r.bidCloseDtm?.getUTCFullYear()).toBe(2026);
    expect(r.bidCloseDtm?.getUTCMonth()).toBe(11); // 12월 = index 11
  });

  it('미래 마감 → status ongoing (진행중)', () => {
    const r = transformAuctionItem(base)!;
    expect(r.status).toBe('ongoing');
  });

  it('입찰 시작 전이면 scheduled(예정)', () => {
    const r = transformAuctionItem({ ...base, cltrBidBgngDt: '202612011100', cltrBidEndDt: '202612021600' })!;
    expect(r.status).toBe('scheduled');
  });

  it('종료일이 지났어도 활성 목록 물건은 closed가 아니라 ongoing (pbctStatNm 없을 때 날짜 fallback)', () => {
    const r = transformAuctionItem({ ...base, cltrBidBgngDt: '202501011100', cltrBidEndDt: '202502011600' })!;
    expect(r.status).toBe('ongoing');
  });

  it('pbctStatNm="입찰준비중"이면 begin이 과거여도 scheduled(예정) — API 상태가 권위값', () => {
    const r = transformAuctionItem({ ...base, pbctStatNm: '입찰준비중', cltrBidBgngDt: '202501011100', cltrBidEndDt: '202502011600' })!;
    expect(r.status).toBe('scheduled');
  });

  it('pbctStatNm="입찰진행중"이면 ongoing', () => {
    const r = transformAuctionItem({ ...base, pbctStatNm: '입찰진행중', cltrBidBgngDt: '202612011100' })!;
    expect(r.status).toBe('ongoing');
  });

  it('pbctStatNm="수의계약가능"이면 negotiable(수의계약)', () => {
    const r = transformAuctionItem({ ...base, pbctStatNm: '수의계약가능' })!;
    expect(r.status).toBe('negotiable');
  });

  it('far-future sentinel 날짜(2999~)는 null (기한 미정)', () => {
    const r = transformAuctionItem({ ...base, cltrBidBgngDt: '202601011000', cltrBidEndDt: '299912301600' })!;
    expect(r.bidCloseDtm).toBeNull();
  });

  it('입찰방식·경쟁방식·입찰구분·명도책임·지분·썸네일 매핑', () => {
    const r = transformAuctionItem({
      ...base,
      bidMthodNm: '최고가방식', cptnMthodNm: '일반경쟁', bidDivNm: '전자입찰',
      evcRsbyTrgtCont: '매수자', alcYn: 'Y', thnlImgUrlAdr: 'https://onbid/x.jpg',
    })!;
    expect(r.bidMethod).toBe('최고가방식');
    expect(r.competitionMethod).toBe('일반경쟁');
    expect(r.bidType).toBe('전자입찰');
    expect(r.evictionResp).toBe('매수자');
    expect(r.isShare).toBe(true);
    expect(r.thumbnailUrl).toBe('https://onbid/x.jpg');
  });

  it('면적은 소수점 보존, 0은 null', () => {
    const r = transformAuctionItem({ ...base, landSqms: 62.453, bldSqms: 0 })!;
    expect(r.landArea).toBe('62.453');
    expect(r.bldArea).toBeNull();
  });

  it('빈 금액/누락 필드는 null', () => {
    const r = transformAuctionItem({ ...base, apslEvlAmt: ' ', lowstBidPrcIndctCont: '' })!;
    expect(r.apslAssAmt).toBeNull();
    expect(r.minBidPrc).toBeNull();
  });

  it('필수 식별자(cltrMngNo) 없으면 null 반환(스킵)', () => {
    expect(transformAuctionItem({ ...base, cltrMngNo: '' })).toBeNull();
  });

  it('ltnoPnu 없고 rdnmPnu 있으면 rdnmPnu로 bjdCode 산출', () => {
    const r = transformAuctionItem({ ...base, ltnoPnu: '', rdnmPnu: '2644010100104810001' })!;
    expect(r.bjdCode).toBe('26440');
  });

  it('ltnoPnu/rdnmPnu 모두 없으면 bjdCode 빈 문자열', () => {
    const r = transformAuctionItem({ ...base, ltnoPnu: '', rdnmPnu: '' })!;
    expect(r.bjdCode).toBe('');
  });

  it('토지 용도 → usageGroup land', () => {
    const r = transformAuctionItem({ ...base, cltrUsgMclsCtgrNm: '토지', cltrUsgSclsCtgrNm: '임야' })!;
    expect(r.usage).toBe('토지 임야');
    expect(r.usageGroup).toBe('land');
  });

  it('pvctTrgtYn Y → true', () => {
    const r = transformAuctionItem({ ...base, pvctTrgtYn: 'Y' })!;
    expect(r.pvctTrgtYn).toBe(true);
  });
});
