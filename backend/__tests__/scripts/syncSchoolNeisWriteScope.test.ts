import { describe, it, expect } from 'vitest';
import {
  buildNeisSchoolData,
  resolveNeisWriteData,
  type NeisSchoolRow,
} from '../../src/scripts/syncSchoolNeis.js';

/**
 * NEIS sync 쓰기 범위 — NEIS 가 학교 데이터의 단일 소스다.
 *
 * ## 왜 한때 신원 쓰기를 막았는가
 *
 * mergeSchoolNeis가 학교명만으로 NEIS를 매칭해(동명 1,069개 이름·2,615행) 표준데이터 행
 * 940건에 남의 학교 neisSchoolCode를 박았고, syncSchoolNeis가 그 링크를 따라
 * city/district/roadAddress/전화/교육청을 매번 덮어썼다. 동명이라 이름은 그대로여서
 * 좌표는 서울인데 주소는 대구인 키메라 행이 되고, 같은 학교가 지역을 달리해 2페이지로 노출됐다.
 * 급한 처방은 표준 sourceId('B'+9자리) 행에 신원을 쓰지 않는 것이었다(#783).
 *
 * ## 왜 지금은 쓰는가
 *
 * 그 처방은 표준데이터가 신원의 권위라는 전제에 기댄 것이었다. 전제가 깨졌다 —
 * 표준데이터(CSV·tn_ API 모두 referenceDate 2026-03-20)는 2026 인천 행정구역 개편을
 * 반영하지 않아 제물포·영종·서해·검단구가 0건이고, NEIS 는 반영한다. 표준데이터로
 * 지역을 쓰면 이미 채택한 신설구가 되돌아간다.
 *
 * 그래서 학교 데이터를 NEIS 단일 소스로 재구성했다(사용자 결정). reconcileSchoolNeisRows 가
 * 링크를 정확 매핑으로 다시 맺고(교정 940·신규 1,541) 중복 1,594를 301, NEIS 에 없는 113을
 * 410 처리했다. 링크가 맞으므로 신원을 따라 써도 남의 학교 값이 오지 않는다.
 *
 * 링크 오연결에 대한 방어는 여기가 아니라 upsert 경로에 남아 있다 —
 * 같은 neisSchoolCode 가 여러 행에 걸리면 아무 행도 쓰지 않는다(syncSchoolNeisUpsert.test.ts).
 *
 * 신원/보강 구분 자체는 유지한다. 필드가 어느 소스에서 오는지를 코드에 남겨두면
 * 소유권이 다시 바뀔 때 무엇을 건드려야 하는지 한곳에서 보인다.
 */

// 표준데이터 20열에 대응하는 필드.
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

// 표준데이터에 없는 필드.
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

describe('resolveNeisWriteData - 단일 소스이므로 신원까지 쓴다', () => {
  const built = () => buildNeisSchoolData(neisRow())!;

  it('신원 필드를 전부 쓴다', () => {
    const data = resolveNeisWriteData(built());
    for (const field of IDENTITY_FIELDS) {
      expect(data, `신원 필드 ${field}를 써야 한다`).toHaveProperty(field);
    }
  });

  it('보강 필드를 전부 쓴다', () => {
    const data = resolveNeisWriteData(built());
    for (const field of ENRICHMENT_FIELDS) {
      expect(data, `보강 필드 ${field}를 써야 한다`).toHaveProperty(field);
    }
  });

  it('syncedAt 을 갱신한다', () => {
    // 단일 소스가 됐으므로 NEIS 실행이 곧 이 행의 신선도다. 찍지 않으면
    // 사이트맵 lastmod 와 sync 중단 감지가 다시 눈을 잃는다.
    const data = resolveNeisWriteData(built());
    expect(data.syncedAt).toBeInstanceOf(Date);
  });

  it('신원·보강·syncedAt 외에는 아무 필드도 쓰지 않는다', () => {
    // 여기서 새는 필드가 있으면 SKIP_UPDATE_COLS(viewCount·createdAt 등)를
    // 우회해 사용자 데이터를 덮을 수 있다.
    const data = resolveNeisWriteData(built());
    const allowed = [...IDENTITY_FIELDS, ...ENRICHMENT_FIELDS, 'syncedAt'].sort();
    expect(Object.keys(data).sort()).toEqual(allowed);
  });

  it('sourceId 형태로 분기하지 않는다', () => {
    // #783 은 표준 sourceId 행에만 신원을 막으려고 sourceId 를 인자로 받았다.
    // 단일 소스에서는 그 분기가 오염 행을 영구히 고치지 못하게 만든다 —
    // 인자가 다시 늘면 분기가 돌아온 것이므로 여기서 막는다.
    expect(resolveNeisWriteData.length).toBe(1);
  });
});
