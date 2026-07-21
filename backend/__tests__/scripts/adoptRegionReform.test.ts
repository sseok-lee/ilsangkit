// adoptRegionReform 마이그레이션 스크립트 — 순수함수 테스트 (TDD, hermetic).
//
// ⚠️ 이 테스트는 외부 의존(실 DB / 실 API 키)이 0이어야 한다.
//   (Phase A A3 테스트가 CI에서 실DB/실키 의존으로 터진 교훈)
//   - prisma는 vi.mock으로 완전 차단(모듈 최상위 import의 PrismaClient 생성 방지).
//   - planCityNormalization / computeNormalizationPlan / reencodeSourceId 는 순수함수라
//     DB·네트워크·env를 전혀 건드리지 않는다.
//   검증: env -u DATABASE_URL -u KAKAO_REST_API_KEY -u OPENAPI_SERVICE_KEY npx vitest run 통과.

import { describe, it, expect, vi } from 'vitest';

// prisma 모듈을 무력화 — apply 실행부가 import하는 PrismaClient 생성/연결을 차단한다.
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {},
}));

import {
  planCityNormalization,
  computeNormalizationPlan,
  reencodeSourceId,
  REGION12_LOOKUP,
  SOURCEID_BJD_TABLES,
  type ReformRow,
} from '../../src/scripts/adoptRegionReform.js';
import { JNGJ_CITY, JNGJ_DISTRICTS } from '../../src/lib/normalizeRegionName.js';

describe('REGION12_LOOKUP (정본 매핑 — 시작 시 27쌍 완비 assert 대상)', () => {
  it('정확히 27쌍이며 JNGJ_DISTRICTS 전부를 12xxx로 커버한다', () => {
    expect(REGION12_LOOKUP.size).toBe(27);
    expect(JNGJ_DISTRICTS.size).toBe(27);
    for (const d of JNGJ_DISTRICTS) {
      const code = REGION12_LOOKUP.get(d);
      expect(code, `district ${d} 매핑 누락`).toBeDefined();
      expect(code!.startsWith('12'), `district ${d} → ${code} (12 접두 아님)`).toBe(true);
      expect(code!).toHaveLength(5);
    }
    // 역방향: lookup의 모든 키가 JNGJ_DISTRICTS에 존재 (오탈자 방지)
    for (const key of REGION12_LOOKUP.keys()) {
      expect(JNGJ_DISTRICTS.has(key), `lookup 키 ${key} 가 JNGJ_DISTRICTS에 없음`).toBe(true);
    }
  });

  it('정본 매핑 표본값 (region12-mapping.md 실측)', () => {
    expect(REGION12_LOOKUP.get('동구')).toBe('12210');
    expect(REGION12_LOOKUP.get('목포시')).toBe('12110');
    expect(REGION12_LOOKUP.get('북구')).toBe('12300');
    expect(REGION12_LOOKUP.get('신안군')).toBe('12870');
    expect(REGION12_LOOKUP.get('광산구')).toBe('12330');
  });
});

describe('reencodeSourceId (옛 bjdCode 토큰 전체 → 신 bjdCode 치환)', () => {
  it('2번째 토큰(bjdCode)만 전체 치환한다 (단순 접두치환 아님)', () => {
    expect(reencodeSourceId('aptSale-29140-2015-2024-3-15-10-84.5-50000', '29140', '12210')).toBe(
      'aptSale-12210-2015-2024-3-15-10-84.5-50000'
    );
  });

  it('전남(46) 코드도 전체 치환', () => {
    expect(reencodeSourceId('offitelRent-46110-2018-2024-5-20-7-59.8-1000-30', '46110', '12110')).toBe(
      'offitelRent-12110-2018-2024-5-20-7-59.8-1000-30'
    );
  });

  it('land sourceId(가변 토큰: dongName 포함)에서도 bjdCode 토큰만 치환', () => {
    expect(reencodeSourceId('landSale-29200-충장동-12-2024-3-15-100-500000000', '29200', '12210')).toBe(
      'landSale-12210-충장동-12-2024-3-15-100-500000000'
    );
  });

  it('oldBjd 토큰이 없으면 원본 그대로 반환 (오검출 방지)', () => {
    expect(reencodeSourceId('aptSale-11110-2015-2024-3-15-10-84.5-50000', '29140', '12210')).toBe(
      'aptSale-11110-2015-2024-3-15-10-84.5-50000'
    );
  });

  it('oldBjd === newBjd 이면 원본 그대로', () => {
    expect(reencodeSourceId('aptSale-12210-2015', '12210', '12210')).toBe('aptSale-12210-2015');
  });
});

describe('planCityNormalization — 브리프 4+ 케이스', () => {
  const lookup = REGION12_LOOKUP;

  it('(a) 거래 재코딩: AptSaleTransaction 29140/광주/동구 → JNGJ + 12210 + sourceId 치환', () => {
    const rows: ReformRow[] = [
      {
        id: 1,
        table: 'AptSaleTransaction',
        city: '광주',
        district: '동구',
        bjdCode: '29140',
        sourceId: 'aptSale-29140-2015-2024-3-15-10-84.5-50000',
      },
    ];
    const planned = planCityNormalization(rows, lookup);
    expect(planned).toHaveLength(1);
    const p = planned[0];
    expect(p.id).toBe(1);
    expect(p.table).toBe('AptSaleTransaction');
    expect(p.fromCity).toBe('광주');
    expect(p.toCity).toBe(JNGJ_CITY);
    expect(p.fromBjd).toBe('29140');
    expect(p.toBjd).toBe('12210');
    expect(p.fromSourceId).toBe('aptSale-29140-2015-2024-3-15-10-84.5-50000');
    expect(p.toSourceId).toBe('aptSale-12210-2015-2024-3-15-10-84.5-50000');
  });

  it('(b) district 매칭 실패 → planned 제외 + skip 리포트', () => {
    const rows: ReformRow[] = [
      { id: 2, table: 'AptSaleTransaction', city: '광주', district: '없는군', bjdCode: '29999', sourceId: 'aptSale-29999-x' },
    ];
    const planned = planCityNormalization(rows, lookup);
    expect(planned).toHaveLength(0); // planned에서 제외

    const plan = computeNormalizationPlan(rows, lookup);
    expect(plan.planned).toHaveLength(0);
    expect(plan.skippedDistrictUnmatched).toHaveLength(1);
    expect(plan.skippedDistrictUnmatched[0].district).toBe('없는군');
    expect(plan.skippedDistrictUnmatched[0].id).toBe(2);
  });

  it('(c) 경기도 광주시(41610) → 절대 제외 (planned 부재, non-target)', () => {
    const rows: ReformRow[] = [
      { id: 3, table: 'AptSaleTransaction', city: '경기도', district: '광주시', bjdCode: '41610', sourceId: 'aptSale-41610-x' },
      { id: 4, table: 'Parking', city: '경기', district: '광주시', bjdCode: '41610' },
    ];
    const planned = planCityNormalization(rows, lookup);
    expect(planned).toHaveLength(0);

    const plan = computeNormalizationPlan(rows, lookup);
    expect(plan.excludedNonTarget).toBe(2);
    expect(plan.skippedDistrictUnmatched).toHaveLength(0);
  });

  it('(d) bjdCode 빈 Auction 스냅샷 → city만 JNGJ, bjdCode/sourceId 불변', () => {
    const rows: ReformRow[] = [
      { id: 5, table: 'AuctionItem', city: '광주광역시', district: '동구', bjdCode: '', sourceId: 'auction-CLTR123' },
    ];
    const planned = planCityNormalization(rows, lookup);
    expect(planned).toHaveLength(1);
    const p = planned[0];
    expect(p.toCity).toBe(JNGJ_CITY);
    expect(p.fromCity).toBe('광주광역시');
    expect(p.toBjd).toBeUndefined(); // bjdCode 유지
    expect(p.fromBjd).toBeUndefined();
    expect(p.toSourceId).toBeUndefined(); // sourceId 불변
  });

  it('(e) Offitel 재코딩: OffitelRentTransaction 46110/전남/목포시 → 12110 + sourceId 치환', () => {
    const rows: ReformRow[] = [
      {
        id: 6,
        table: 'OffitelRentTransaction',
        city: '전남',
        district: '목포시',
        bjdCode: '46110',
        sourceId: 'offitelRent-46110-2018-2024-5-20-7-59.8-1000-30',
      },
    ];
    const planned = planCityNormalization(rows, lookup);
    expect(planned).toHaveLength(1);
    const p = planned[0];
    expect(p.toCity).toBe(JNGJ_CITY);
    expect(p.fromBjd).toBe('46110');
    expect(p.toBjd).toBe('12110');
    expect(p.toSourceId).toBe('offitelRent-12110-2018-2024-5-20-7-59.8-1000-30');
  });
});

describe('planCityNormalization — 테이블 종류별 규칙', () => {
  const lookup = REGION12_LOOKUP;

  it('AuctionItem: bjdCode 있는 행은 재코딩하되 sourceId(auction-CLTR)는 불변 (bjd 미임베드)', () => {
    const rows: ReformRow[] = [
      { id: 10, table: 'AuctionItem', city: '전라남도', district: '여수시', bjdCode: '46130', sourceId: 'auction-CLTR9' },
    ];
    const [p] = planCityNormalization(rows, lookup);
    expect(p.toCity).toBe(JNGJ_CITY);
    expect(p.fromBjd).toBe('46130');
    expect(p.toBjd).toBe('12130');
    expect(p.toSourceId).toBeUndefined(); // AuctionItem sourceId는 bjdCode를 담지 않음 → 재코딩 금지
    expect(SOURCEID_BJD_TABLES.has('AuctionItem')).toBe(false);
  });

  it('시설(Aed): city+bjdCode만 재코딩, sourceId 불변 (facility sourceId는 bjd 미임베드)', () => {
    const rows: ReformRow[] = [
      { id: 11, table: 'Aed', city: '광주광역시', district: '북구', bjdCode: '29170', sourceId: 'somehash' },
    ];
    const [p] = planCityNormalization(rows, lookup);
    expect(p.toCity).toBe(JNGJ_CITY);
    expect(p.fromBjd).toBe('29170');
    expect(p.toBjd).toBe('12300');
    expect(p.toSourceId).toBeUndefined();
    expect(SOURCEID_BJD_TABLES.has('Aed')).toBe(false);
  });

  it('city-only 테이블(SubwayStation, bjdCode 컬럼 없음): city만 변경', () => {
    const rows: ReformRow[] = [
      { id: 'subway-x', table: 'SubwayStation', city: '광주광역시', district: '서구' /* bjdCode 없음 */ },
    ];
    const [p] = planCityNormalization(rows, lookup);
    expect(p.toCity).toBe(JNGJ_CITY);
    expect(p.toBjd).toBeUndefined();
    expect(p.toSourceId).toBeUndefined();
  });

  it('멱등: 이미 신 city + 12xxx bjdCode 인 행은 변경 없음(unchanged)', () => {
    const rows: ReformRow[] = [
      { id: 20, table: 'AptSaleTransaction', city: JNGJ_CITY, district: '동구', bjdCode: '12210', sourceId: 'aptSale-12210-x' },
    ];
    const planned = planCityNormalization(rows, lookup);
    expect(planned).toHaveLength(0);
    const plan = computeNormalizationPlan(rows, lookup);
    expect(plan.unchanged).toBe(1);
  });

  it('무관 지역(서울)은 non-target으로 제외', () => {
    const rows: ReformRow[] = [
      { id: 30, table: 'AptSaleTransaction', city: '서울특별시', district: '강남구', bjdCode: '11680', sourceId: 'aptSale-11680-x' },
    ];
    expect(planCityNormalization(rows, lookup)).toHaveLength(0);
  });

  it('concat 오염 city("광주광역시동구") 도 정규화되어 재코딩된다', () => {
    const rows: ReformRow[] = [
      { id: 40, table: 'Parking', city: '광주광역시동구', district: '동구', bjdCode: '29140' },
    ];
    const [p] = planCityNormalization(rows, lookup);
    expect(p.toCity).toBe(JNGJ_CITY);
    expect(p.toBjd).toBe('12210');
  });
});
