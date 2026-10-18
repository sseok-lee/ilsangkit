import { describe, it, expect } from 'vitest';
import {
  transformAll,
  createTransformContext,
  transformSubwayRow,
  type SubwayCsvRow,
} from '../../src/services/subwayDataSource.js';

function row(stationCode: string, name: string, lineCode: string, lineName: string, englishName: string): SubwayCsvRow {
  return {
    '역번호': stationCode,
    '역사명': name,
    '노선번호': lineCode,
    '노선명': lineName,
    '영문역사명': englishName,
    '한자역사명': '',
    '환승역구분': '',
    '환승노선번호': '',
    '환승노선명': '',
    '역위도': '37.5161',
    '역경도': '127.0197',
    '운영기관명': '',
    '역사도로명주소': '서울특별시 강남구 강남대로 620',
    '역사전화번호': '',
    '데이터기준일자': '',
  } as SubwayCsvRow;
}

const SINSA_LINE3 = row('0337', '신사', 'I1103', '3호선', 'Sinsa');
const SINSA_SHINBUNDANG = row('D004', '신사', 'I11D1', '신분당선', 'Sinsa');

function slugBySourceId(rows: SubwayCsvRow[], existing?: Map<string, string>): Map<string, string> {
  const { stations } = transformAll(rows, existing);
  return new Map(stations.map((s) => [s.sourceId, s.nameSlug]));
}

describe('subwayDataSource slug 안정성', () => {
  it('기존 slug 가 없으면 CSV 먼저 나온 역이 기본 slug 를 가진다', () => {
    const slugs = slugBySourceId([SINSA_LINE3, SINSA_SHINBUNDANG]);
    expect(slugs.get('0337-I1103')).toBe('sinsa');
    expect(slugs.get('D004-I11D1')).toBe('sinsa-i11d1');
  });

  it('CSV 순서가 바뀌어도 기존 역은 DB 에 저장된 slug 를 그대로 쓴다', () => {
    const existing = new Map([
      ['0337-I1103', 'sinsa'],
      ['D004-I11D1', 'sinsa-i11d1'],
    ]);
    const slugs = slugBySourceId([SINSA_SHINBUNDANG, SINSA_LINE3], existing);
    expect(slugs.get('0337-I1103')).toBe('sinsa');
    expect(slugs.get('D004-I11D1')).toBe('sinsa-i11d1');
  });

  it('새 역은 기존 slug(이번 CSV 에 없는 역 포함)와 겹치지 않는 slug 를 받는다', () => {
    const existing = new Map([
      ['0337-I1103', 'sinsa'],
      ['9999-X0000', 'sinsa-i11d1'], // CSV 에서 빠진 옛 역
    ]);
    const slugs = slugBySourceId([SINSA_SHINBUNDANG, SINSA_LINE3], existing);
    expect(slugs.get('0337-I1103')).toBe('sinsa');
    const fresh = slugs.get('D004-I11D1');
    expect(fresh).toBeDefined();
    expect(['sinsa', 'sinsa-i11d1']).not.toContain(fresh);
  });

  it('결과 slug 는 모두 고유하다', () => {
    const existing = new Map([['D004-I11D1', 'sinsa']]);
    const { stations } = transformAll([SINSA_LINE3, SINSA_SHINBUNDANG], existing);
    const slugs = stations.map((s) => s.nameSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(stations.find((s) => s.sourceId === 'D004-I11D1')!.nameSlug).toBe('sinsa');
  });

  it('원본이 역번호 앞자리 0 을 빼도(0101→101) 기존 행·slug 로 갱신한다', () => {
    const existing = new Map([['0101-S3001', 'panam']]);
    const { stations } = transformAll([row('101', '판암', 'S3001', '대전 도시철도 1호선', 'Panam')], existing);
    expect(stations).toHaveLength(1);
    expect(stations[0].sourceId).toBe('0101-S3001');
    expect(stations[0].id).toBe('subway-0101-S3001');
    expect(stations[0].nameSlug).toBe('panam');
  });

  it('노선이 다르면 역번호가 같아도 같은 역으로 보지 않는다', () => {
    const existing = new Map([['0101-S2601', 'nopo']]);
    const { stations } = transformAll([row('101', '판암', 'S3001', '대전 도시철도 1호선', 'Panam')], existing);
    expect(stations[0].sourceId).toBe('101-S3001');
    expect(stations[0].nameSlug).toBe('panam');
  });

  it('앞자리 0 만 다른 기존 역이 둘이면 별칭을 쓰지 않는다', () => {
    const existing = new Map([['0101-S3001', 'a'], ['00101-S3001', 'b']]);
    const { stations } = transformAll([row('101', '판암', 'S3001', '대전 도시철도 1호선', 'Panam')], existing);
    expect(stations[0].sourceId).toBe('101-S3001');
  });

  it('createTransformContext() 인자 없이 호출하던 기존 사용법도 동작한다', () => {
    const t = transformSubwayRow(SINSA_LINE3, createTransformContext());
    expect(t!.nameSlug).toBe('sinsa');
  });
});
