import { describe, it, expect } from 'vitest';
import {
  isStandardDataSourceId,
  buildNeisSchoolData,
  resolveNeisWriteData,
  mayNeisCreateRow,
  type NeisSchoolRow,
} from '../../src/scripts/syncSchoolNeis.js';

/**
 * NEIS sync 쓰기 범위 제한.
 *
 * 운영 사고: mergeSchoolNeis가 학교명만으로 NEIS를 매칭해 표준데이터 행 1,234건에
 * 남의 학교 neisSchoolCode를 박았고, 이후 syncSchoolNeis가 그 링크를 따라
 * city/district/roadAddress/전화/교육청을 매번 덮어썼다. 동명이라 이름은 그대로여서
 * 좌표는 서울인데 주소는 대구인 키메라 행이 되고, 같은 학교가 지역을 달리해 2페이지로 노출됐다.
 *
 * 소유권 경계: 전국초중등학교위치표준데이터(CSV/tn_ API) 20열에 대응되는 필드는
 * 표준데이터가 소유하고, 거기에 없는 필드만 NEIS가 채운다. 표준데이터 학교ID는
 * 'B'+9자리이며 운영 DB 10,956행 전부 이 형식(예외 0건)이라 sourceId 형태로 소유자를 판별한다.
 */

// 표준데이터 20열에 대응 → NEIS가 표준데이터 행에 절대 쓰면 안 되는 필드.
// 소스의 상수를 재사용하지 않고 리터럴로 적어 상수 편집만으로 테스트가 통과하지 않게 한다.
const IDENTITY_FIELDS = [
  'name',
  'address',
  'roadAddress',
  'city',
  'district',
  'schoolLevel',
  'foundedDate',
  'foundationType',
  'operationStatus',
  'sidoEduCode',
  'sidoEduName',
  'localEduName',
  'modifiedDate',
] as const;

// 표준데이터에 없는 필드 → NEIS가 소유.
const ENRICHMENT_FIELDS = [
  'neisEduCode',
  'phoneNumber',
  'faxNumber',
  'homepageUrl',
  'coeducationType',
  'highSchoolType',
  'dayNightType',
] as const;

function neisRow(overrides: Partial<NeisSchoolRow> = {}): NeisSchoolRow {
  return {
    ATPT_OFCDC_SC_CODE: 'D10',
    ATPT_OFCDC_SC_NM: '대구광역시교육청',
    SD_SCHUL_CODE: '7240097',
    SCHUL_NM: '영신고등학교',
    ENG_SCHUL_NM: 'Yeongsin High School',
    SCHUL_KND_SC_NM: '고등학교',
    LCTN_SC_NM: '대구광역시',
    JU_ORG_NM: '대구광역시동부교육지원청',
    FOND_SC_NM: '사립',
    ORG_RDNZC: '41068',
    ORG_RDNMA: '대구광역시 동구 팔공로50길 32',
    ORG_RDNDA: '(봉무동)',
    ORG_TELNO: '053-235-4700',
    HMPG_ADRES: 'http://www.yeongsin.hs.kr',
    COEDU_SC_NM: '남',
    ORG_FAXNO: '053-235-4701',
    HS_SC_NM: '일반고',
    INDST_SPECL_CCCCL_EXST_YN: 'N',
    HS_GNRL_BUSNS_SC_NM: '일반',
    SPCLY_PURPS_HS_ORD_NM: '',
    ENE_BFE_SEHF_SC_NM: '전기',
    DGHT_SC_NM: '주간',
    FOND_YMD: '1966-01-20',
    FOAS_MEMRD: '1966-03-01',
    LOAD_DTM: '2026-08-26',
    ...overrides,
  };
}

describe('isStandardDataSourceId - 표준데이터 소유 행 판별', () => {
  it('B + 9자리(총 10자)를 표준데이터 학교ID로 판별한다', () => {
    expect(isStandardDataSourceId('B000012035')).toBe(true);
    expect(isStandardDataSourceId('B000007437')).toBe(true);
  });

  it('NEIS 7자리 숫자 코드는 표준데이터가 아니다', () => {
    expect(isStandardDataSourceId('7010100')).toBe(false);
    expect(isStandardDataSourceId('7240097')).toBe(false);
  });

  it('길이가 10이 아닌 B 접두 코드는 표준데이터가 아니다', () => {
    // 운영 DB의 재외한국학교(B555317)는 len 7 — NEIS가 만든 행이다.
    expect(isStandardDataSourceId('B555317')).toBe(false);
    expect(isStandardDataSourceId('B00001203')).toBe(false);
    expect(isStandardDataSourceId('B0000120355')).toBe(false);
  });

  it('B 뒤가 숫자가 아니면 표준데이터가 아니다', () => {
    expect(isStandardDataSourceId('BX00012035')).toBe(false);
  });

  it('C 접두 국립대부설 코드는 표준데이터가 아니다', () => {
    expect(isStandardDataSourceId('C035902')).toBe(false);
  });

  it('빈 문자열과 공백은 표준데이터가 아니다', () => {
    expect(isStandardDataSourceId('')).toBe(false);
    expect(isStandardDataSourceId('   ')).toBe(false);
  });
});

describe('buildNeisSchoolData - 신원/보강 분리', () => {
  it('신원과 보강을 분리해 반환한다', () => {
    const built = buildNeisSchoolData(neisRow());
    expect(built).not.toBeNull();
    expect(Object.keys(built!.identity).sort()).toEqual([...IDENTITY_FIELDS].sort());
    expect(Object.keys(built!.enrichment).sort()).toEqual([...ENRICHMENT_FIELDS].sort());
  });

  it('도로명주소에서 city/district를 도출한다', () => {
    const built = buildNeisSchoolData(neisRow());
    expect(built!.identity.city).toBe('대구');
    expect(built!.identity.district).toBe('동구');
    expect(built!.identity.roadAddress).toBe('대구광역시 동구 팔공로50길 32 (봉무동)');
  });

  it('보강 필드에 NEIS 전용 값이 담긴다', () => {
    const built = buildNeisSchoolData(neisRow());
    expect(built!.enrichment.phoneNumber).toBe('053-235-4700');
    expect(built!.enrichment.faxNumber).toBe('053-235-4701');
    expect(built!.enrichment.homepageUrl).toBe('http://www.yeongsin.hs.kr');
    expect(built!.enrichment.dayNightType).toBe('주간');
    expect(built!.enrichment.highSchoolType).toBe('일반고');
    expect(built!.enrichment.neisEduCode).toBe('D10');
  });

  it('학교코드/학교명/학교급/도로명이 없으면 null을 반환한다', () => {
    expect(buildNeisSchoolData(neisRow({ SD_SCHUL_CODE: '' }))).toBeNull();
    expect(buildNeisSchoolData(neisRow({ SCHUL_NM: '' }))).toBeNull();
    expect(buildNeisSchoolData(neisRow({ SCHUL_KND_SC_NM: '' }))).toBeNull();
    expect(buildNeisSchoolData(neisRow({ ORG_RDNMA: '', ORG_RDNDA: '' }))).toBeNull();
  });

  it('검정고시는 학교가 아니므로 null을 반환한다', () => {
    expect(buildNeisSchoolData(neisRow({ SCHUL_NM: '서울시교육청 검정고시' }))).toBeNull();
  });

  it('도로명주소에서 city/district를 못 뽑으면 null을 반환한다', () => {
    expect(buildNeisSchoolData(neisRow({ ORG_RDNMA: '대구광역시', ORG_RDNDA: '' }))).toBeNull();
  });
});

describe('resolveNeisWriteData - 표준데이터 행에는 신원을 쓰지 않는다', () => {
  const built = () => buildNeisSchoolData(neisRow())!;

  it('표준데이터 행(B+9)에는 신원 필드를 단 하나도 쓰지 않는다', () => {
    const data = resolveNeisWriteData('B000012035', built());
    for (const field of IDENTITY_FIELDS) {
      expect(data, `표준데이터 행에 ${field}를 쓰면 안 된다`).not.toHaveProperty(field);
    }
  });

  it('표준데이터 행에도 보강 필드는 갱신한다', () => {
    const data = resolveNeisWriteData('B000012035', built());
    for (const field of ENRICHMENT_FIELDS) {
      expect(data).toHaveProperty(field);
    }
  });

  it('표준데이터 행의 syncedAt은 갱신하지 않는다', () => {
    // syncedAt은 소유 소스만 갱신한다. NEIS가 대신 찍으면 표준 sync가 6개월 멈춘 것을
    // 신선도 지표로 감지할 수 없다 — 이번 사고가 그렇게 가려졌다.
    const data = resolveNeisWriteData('B000012035', built());
    expect(data).not.toHaveProperty('syncedAt');
  });

  it('NEIS 소유 행(7자리)에는 신원과 보강을 모두 쓴다', () => {
    const data = resolveNeisWriteData('7240097', built());
    for (const field of IDENTITY_FIELDS) {
      expect(data).toHaveProperty(field);
    }
    for (const field of ENRICHMENT_FIELDS) {
      expect(data).toHaveProperty(field);
    }
    expect(data.syncedAt).toBeInstanceOf(Date);
  });

  it('NEIS가 만든 재외한국학교/국립대부설 행에도 신원을 쓴다', () => {
    expect(resolveNeisWriteData('B555317', built())).toHaveProperty('name');
    expect(resolveNeisWriteData('C035902', built())).toHaveProperty('name');
  });

  it('오연결된 표준데이터 행의 지역이 남의 학교 값으로 덮이지 않는다', () => {
    // 실제 사고 행: school-B000012035(서울 영등포 영신고)가 대구 영신고 코드에 연결돼 있었다.
    const data = resolveNeisWriteData('B000012035', built());
    expect(data).not.toHaveProperty('city');
    expect(data).not.toHaveProperty('district');
    expect(data).not.toHaveProperty('roadAddress');
    expect(data).not.toHaveProperty('sidoEduName');
    expect(JSON.stringify(data)).not.toContain('대구');
  });
});

describe('mayNeisCreateRow - 초·중·고 신규 행은 NEIS가 만들지 않는다', () => {
  it('표준데이터가 소유하는 초·중·고는 생성하지 않는다', () => {
    // 2026-03-20 NEIS 첫 실행이 표준 12,014행 위에 12,563행을 새로 만들어
    // 전면 중복을 만든 경로를 차단한다.
    expect(mayNeisCreateRow('초등학교')).toBe(false);
    expect(mayNeisCreateRow('중학교')).toBe(false);
    expect(mayNeisCreateRow('고등학교')).toBe(false);
  });

  it('표준데이터에 없는 학교급은 NEIS만이 소스이므로 생성한다', () => {
    // 운영 DB 실측: 이 학교급들은 표준행 0건, NEIS행만 존재한다.
    expect(mayNeisCreateRow('특수학교')).toBe(true);
    expect(mayNeisCreateRow('각종학교(고)')).toBe(true);
    expect(mayNeisCreateRow('평생학교(고)-2년6학기')).toBe(true);
    expect(mayNeisCreateRow('외국인학교')).toBe(true);
    expect(mayNeisCreateRow('공동실습소')).toBe(true);
    expect(mayNeisCreateRow('재외한국학교(초)')).toBe(true);
    expect(mayNeisCreateRow('국제학교')).toBe(true);
  });

  it('방송통신고등학교처럼 이름에 고등이 들어가도 별개 학교급이면 생성한다', () => {
    // mapSchoolLevel은 "고등" 포함만 보고 고등학교로 접지만, 생성 판단은
    // 원본 학교급(SCHUL_KND_SC_NM)을 그대로 봐야 표준데이터 범위를 넘는 학교를 잃지 않는다.
    expect(mayNeisCreateRow('방송통신고등학교')).toBe(true);
  });

  it('앞뒤 공백은 무시한다', () => {
    expect(mayNeisCreateRow(' 초등학교 ')).toBe(false);
  });

  it('빈 학교급은 생성하지 않는 쪽이 아니라 표준 소유가 아니므로 허용된다', () => {
    // 빈 학교급은 buildNeisSchoolData가 이미 null로 걸러내므로 여기 도달하지 않는다.
    expect(mayNeisCreateRow('')).toBe(true);
  });
});
