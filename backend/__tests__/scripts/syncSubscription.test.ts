import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  transformSubscription,
  type SubscriptionApiItem,
} from '../../src/scripts/syncSubscription.js';

// 공통 mandatory 필드 — 응답 envelope 차이만 케이스마다 세팅.
const baseItem: Pick<
  SubscriptionApiItem,
  | 'HOUSE_MANAGE_NO'
  | 'PBLANC_NO'
  | 'HOUSE_NM'
  | 'HOUSE_SECD_NM'
  | 'HOUSE_DTL_SECD_NM'
  | 'RENT_SECD_NM'
  | 'SUBSCRPT_AREA_CODE_NM'
  | 'HSSPLY_ADRES'
  | 'HSSPLY_ZIP'
  | 'TOT_SUPLY_HSHLDCO'
  | 'RCRIT_PBLANC_DE'
  | 'PRZWNER_PRESNATN_DE'
  | 'CNTRCT_CNCLS_BGNDE'
  | 'CNTRCT_CNCLS_ENDDE'
  | 'MVN_PREARNGE_YM'
  | 'CNSTRCT_ENTRPS_NM'
  | 'BSNS_MBY_NM'
  | 'HMPG_ADRES'
  | 'PBLANC_URL'
  | 'MDHS_TELNO'
> = {
  HOUSE_MANAGE_NO: '2026000001',
  PBLANC_NO: '2026000001',
  HOUSE_NM: '테스트 단지',
  HOUSE_SECD_NM: '아파트',
  HOUSE_DTL_SECD_NM: '',
  RENT_SECD_NM: '',
  SUBSCRPT_AREA_CODE_NM: '서울',
  HSSPLY_ADRES: '서울특별시 종로구 테스트로 1',
  HSSPLY_ZIP: '03000',
  TOT_SUPLY_HSHLDCO: 100,
  RCRIT_PBLANC_DE: '2026-06-01',
  PRZWNER_PRESNATN_DE: null,
  CNTRCT_CNCLS_BGNDE: null,
  CNTRCT_CNCLS_ENDDE: null,
  MVN_PREARNGE_YM: null,
  CNSTRCT_ENTRPS_NM: null,
  BSNS_MBY_NM: null,
  HMPG_ADRES: null,
  PBLANC_URL: null,
  MDHS_TELNO: null,
};

describe('transformSubscription — receptionDate 필드 매핑', () => {
  it('APT 응답: RCEPT_BGNDE/ENDDE 를 receptionStart/End 로 매핑한다', () => {
    const item: SubscriptionApiItem = {
      ...baseItem,
      RCEPT_BGNDE: '2026-06-01',
      RCEPT_ENDDE: '2026-06-05',
    };
    const r = transformSubscription(item, 'APT');
    expect(r.receptionStartDate).toEqual(new Date('2026-06-01'));
    expect(r.receptionEndDate).toEqual(new Date('2026-06-05'));
  });

  it('PRIVATE_RENT 응답: SUBSCRPT_RCEPT_BGNDE/ENDDE 를 receptionStart/End 로 매핑한다', () => {
    const item: SubscriptionApiItem = {
      ...baseItem,
      SUBSCRPT_RCEPT_BGNDE: '2026-06-01',
      SUBSCRPT_RCEPT_ENDDE: '2026-06-05',
    };
    const r = transformSubscription(item, 'PRIVATE_RENT');
    expect(r.receptionStartDate).toEqual(new Date('2026-06-01'));
    expect(r.receptionEndDate).toEqual(new Date('2026-06-05'));
  });

  it('OFFITEL 응답: SUBSCRPT_RCEPT_BGNDE/ENDDE 를 receptionStart/End 로 매핑한다', () => {
    const item: SubscriptionApiItem = {
      ...baseItem,
      SUBSCRPT_RCEPT_BGNDE: '2026-06-01',
      SUBSCRPT_RCEPT_ENDDE: '2026-06-05',
    };
    const r = transformSubscription(item, 'OFFITEL');
    expect(r.receptionStartDate).toEqual(new Date('2026-06-01'));
    expect(r.receptionEndDate).toEqual(new Date('2026-06-05'));
  });

  it('REMAINING 응답: SUBSCRPT_RCEPT_BGNDE/ENDDE 를 receptionStart/End 로 매핑한다', () => {
    const item: SubscriptionApiItem = {
      ...baseItem,
      SUBSCRPT_RCEPT_BGNDE: '2026-06-01',
      SUBSCRPT_RCEPT_ENDDE: '2026-06-05',
    };
    const r = transformSubscription(item, 'REMAINING');
    expect(r.receptionStartDate).toEqual(new Date('2026-06-01'));
    expect(r.receptionEndDate).toEqual(new Date('2026-06-05'));
  });

  it('두 필드가 모두 없으면 receptionStart/End 가 null 이고 status="closed"', () => {
    const item: SubscriptionApiItem = { ...baseItem };
    const r = transformSubscription(item, 'PRIVATE_RENT');
    expect(r.receptionStartDate).toBeNull();
    expect(r.receptionEndDate).toBeNull();
    expect(r.status).toBe('closed');
  });

  it('APT 응답에서 SUBSCRPT_RCEPT_BGNDE 가 함께 와도 RCEPT_BGNDE 가 우선', () => {
    const item: SubscriptionApiItem = {
      ...baseItem,
      RCEPT_BGNDE: '2026-06-01',
      RCEPT_ENDDE: '2026-06-05',
      SUBSCRPT_RCEPT_BGNDE: '2026-07-01',
      SUBSCRPT_RCEPT_ENDDE: '2026-07-05',
    };
    const r = transformSubscription(item, 'APT');
    expect(r.receptionStartDate).toEqual(new Date('2026-06-01'));
    expect(r.receptionEndDate).toEqual(new Date('2026-06-05'));
  });
});

describe('transformSubscription — status 계산', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 7월 한가운데로 고정 — 6월/8월 케이스가 timezone 영향을 받지 않도록 분리.
    vi.setSystemTime(new Date('2026-07-15T03:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('PRIVATE_RENT: 오늘이 접수기간 안이면 ongoing', () => {
    const item: SubscriptionApiItem = {
      ...baseItem,
      SUBSCRPT_RCEPT_BGNDE: '2026-07-10',
      SUBSCRPT_RCEPT_ENDDE: '2026-07-20',
    };
    expect(transformSubscription(item, 'PRIVATE_RENT').status).toBe('ongoing');
  });

  it('PRIVATE_RENT: 접수시작이 미래(다음 달)면 upcoming', () => {
    const item: SubscriptionApiItem = {
      ...baseItem,
      SUBSCRPT_RCEPT_BGNDE: '2026-08-10',
      SUBSCRPT_RCEPT_ENDDE: '2026-08-15',
    };
    expect(transformSubscription(item, 'PRIVATE_RENT').status).toBe('upcoming');
  });

  it('PRIVATE_RENT: 접수종료가 과거(지난 달)면 closed', () => {
    const item: SubscriptionApiItem = {
      ...baseItem,
      SUBSCRPT_RCEPT_BGNDE: '2026-06-10',
      SUBSCRPT_RCEPT_ENDDE: '2026-06-15',
    };
    expect(transformSubscription(item, 'PRIVATE_RENT').status).toBe('closed');
  });

  it('OFFITEL: 진행중 케이스도 동일하게 동작', () => {
    const item: SubscriptionApiItem = {
      ...baseItem,
      SUBSCRPT_RCEPT_BGNDE: '2026-07-10',
      SUBSCRPT_RCEPT_ENDDE: '2026-07-20',
    };
    expect(transformSubscription(item, 'OFFITEL').status).toBe('ongoing');
  });

  it('REMAINING: 예정 케이스도 동일하게 동작', () => {
    const item: SubscriptionApiItem = {
      ...baseItem,
      SUBSCRPT_RCEPT_BGNDE: '2026-08-10',
      SUBSCRPT_RCEPT_ENDDE: '2026-08-15',
    };
    expect(transformSubscription(item, 'REMAINING').status).toBe('upcoming');
  });
});
