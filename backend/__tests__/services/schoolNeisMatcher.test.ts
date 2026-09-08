import { describe, it, expect } from 'vitest';
import {
  normalizeSchoolName,
  extractRoadKey,
  normalizeSidoName,
  buildSchoolNeisMapping,
  type MatchableStandardSchool,
  type MatchableNeisSchool,
} from '../../src/services/schoolNeisMatcher.js';

/**
 * 표준데이터 학교ID ↔ NEIS SD_SCHUL_CODE 매핑.
 *
 * mergeSchoolNeis 는 학교명만으로 매칭했다(`Map.set(n.name, n)`). 실측하면 학교명 단독은
 * 다중 후보가 2,592건이고, 거기서 마지막 하나가 모든 동명 학교에 붙어 표준행 940건에
 * 남의 학교 코드가 박혔다. 학교명에 도로명·건물번호를 더하면 다중 후보가 0건이 된다.
 *
 * 두 소스의 주소 표기가 제각각이라 정규화가 매칭의 전부다. 실측한 차이:
 *   - NEIS 는 도로명 뒤에 학교명을 덧붙인다        "법전로 135 법전중앙초등학교"
 *   - NEIS 는 번길을 쉼표로 쪼갠다                  "금화로 105 , 33" = 금화로105번길 33
 *   - NEIS 는 번길 앞에 공백을 넣는다               "건지로 250번길" vs "건지로250번길"
 *   - 중점 문자가 다르다                            "이화·금란" vs "이화・금란"
 *   - 표준데이터에 도로명주소가 빈 레코드가 있다    → 지번주소로 폴백
 *   - 시/도 표기가 다르다                           "전라남도" vs "전남광주통합특별시"
 */

function std(over: Partial<MatchableStandardSchool> = {}): MatchableStandardSchool {
  return {
    schoolId: 'B000011305',
    schoolNm: '해성국제컨벤션고등학교',
    schoolSe: '고등학교',
    rdnmadr: '서울특별시 동대문구 전농로20길 31',
    lnmadr: '서울특별시 동대문구 전농동 90-3',
    ...over,
  };
}

function neis(over: Partial<MatchableNeisSchool> = {}): MatchableNeisSchool {
  return {
    SD_SCHUL_CODE: '7010266',
    SCHUL_NM: '해성국제컨벤션고등학교',
    SCHUL_KND_SC_NM: '고등학교',
    ORG_RDNMA: '서울특별시 동대문구 전농로20길 31',
    ORG_RDNDA: '(전농동)',
    ...over,
  };
}

describe('normalizeSchoolName', () => {
  it('공백을 제거한다', () => {
    expect(normalizeSchoolName(' 서울 휘경 초등학교 ')).toBe('서울휘경초등학교');
  });

  it('중점 표기 차이를 흡수한다', () => {
    // 표준데이터 "이화·금란중학교" vs NEIS "이화・금란중학교" (U+00B7 vs U+30FB)
    expect(normalizeSchoolName('이화·금란중학교')).toBe(normalizeSchoolName('이화・금란중학교'));
    expect(normalizeSchoolName('이화•금란중학교')).toBe(normalizeSchoolName('이화‧금란중학교'));
  });

  it('꼬리의 (폐교) 표기를 떼어낸다', () => {
    expect(normalizeSchoolName('영동중학교(폐교)')).toBe('영동중학교');
  });

  it('빈 값과 null 을 빈 문자열로 만든다', () => {
    expect(normalizeSchoolName('')).toBe('');
    expect(normalizeSchoolName(undefined)).toBe('');
    expect(normalizeSchoolName(null)).toBe('');
  });
});

describe('extractRoadKey - 도로명 + 건물번호', () => {
  it('시/도·시군구를 무시하고 도로명과 건물번호만 남긴다', () => {
    expect(extractRoadKey('서울특별시 동대문구 전농로20길 31')).toBe('전농로20길31');
    expect(extractRoadKey('경상북도 봉화군 법전면 법전로 135')).toBe('법전로135');
  });

  it('괄호 부기를 제거한다', () => {
    expect(extractRoadKey('서울특별시 동대문구 전농로20길 31 (전농동, 해성고)')).toBe('전농로20길31');
  });

  it('덧붙은 학교명을 제거한다', () => {
    // NEIS 실측: "경상북도 봉화군 법전면 법전로 135 법전중앙초등학교"
    expect(extractRoadKey('경상북도 봉화군 법전면 법전로 135 법전중앙초등학교', '법전중앙초등학교'))
      .toBe('법전로135');
  });

  it('번길 앞 공백 차이를 흡수한다', () => {
    // NEIS "건지로 250번길 43" vs 표준데이터 "건지로250번길 43"
    expect(extractRoadKey('인천광역시 서해구 건지로 250번길 43'))
      .toBe(extractRoadKey('인천광역시 서구 건지로250번길 43'));
    expect(extractRoadKey('인천광역시 서구 건지로250번길 43')).toBe('건지로250번길43');
  });

  it('쉼표로 쪼갠 번길을 복원한다', () => {
    // NEIS "금화로 105 , 33" = 표준데이터 "금화로105번길 33"
    expect(extractRoadKey('경기도 용인시 기흥구 금화로 105 , 33'))
      .toBe(extractRoadKey('경기도 용인시 기흥구 금화로105번길 33'));
  });

  it('건물번호의 부번(-)을 유지한다', () => {
    expect(extractRoadKey('경상북도 청송군 주왕산면 부동로 1011-28')).toBe('부동로1011-28');
  });

  it('대로도 도로명으로 인식한다', () => {
    expect(extractRoadKey('광주광역시 북구 필문대로 55')).toBe('필문대로55');
  });

  it('도로명·건물번호를 못 찾으면 빈 문자열을 반환한다', () => {
    expect(extractRoadKey('인천광역시 서구')).toBe('');
    expect(extractRoadKey('')).toBe('');
    expect(extractRoadKey(undefined)).toBe('');
  });
});

describe('normalizeSidoName', () => {
  it('시/도 접미를 떼어 두 소스의 표기를 맞춘다', () => {
    expect(normalizeSidoName('서울특별시')).toBe('서울');
    expect(normalizeSidoName('경기도')).toBe('경기');
    expect(normalizeSidoName('강원특별자치도')).toBe('강원');
    expect(normalizeSidoName('세종특별자치시')).toBe('세종');
    expect(normalizeSidoName('대구광역시')).toBe('대구');
  });

  it('전남광주통합특별시와 옛 표기를 같은 값으로 만들지는 않는다', () => {
    // 통합 전 표기는 광주/전남으로 갈리므로 시/도 단계에서 억지로 합치지 않는다.
    // 이 단계는 1단계 도로명 매칭이 실패했을 때만 쓰이는 보조 키다.
    expect(normalizeSidoName('전남광주통합특별시')).toBe('전남광주');
  });
});

describe('buildSchoolNeisMapping - 1단계 학교명 + 도로명', () => {
  it('학교명과 도로명이 같으면 매핑한다', () => {
    const r = buildSchoolNeisMapping([std()], [neis()]);
    expect(r.mapping.get('B000011305')).toBe('7010266');
    expect(r.stats.byName_road).toBe(1);
    expect(r.stats.unmatched).toBe(0);
  });

  it('동명이지만 도로명이 다른 학교를 구분한다', () => {
    // 실제 사고: 서울 영등포 영신고가 대구 영신고 코드에 연결됐다.
    const seoul = std({ schoolId: 'B000012035', schoolNm: '영신고등학교', rdnmadr: '서울특별시 영등포구 대방천로14길 18' });
    const daegu = neis({ SD_SCHUL_CODE: '7240097', SCHUL_NM: '영신고등학교', ORG_RDNMA: '대구광역시 동구 팔공로50길 32', ORG_RDNDA: '(봉무동)' });
    const seoulNeis = neis({ SD_SCHUL_CODE: '7010100', SCHUL_NM: '영신고등학교', ORG_RDNMA: '서울 영등포구 대방천로14길 18', ORG_RDNDA: '(신길동,영신고등학교)' });

    const r = buildSchoolNeisMapping([seoul], [daegu, seoulNeis]);
    expect(r.mapping.get('B000012035')).toBe('7010100');
  });

  it('NEIS 가 도로명 뒤에 학교명을 붙여도 매핑한다', () => {
    const s = std({ schoolId: 'B000007402', schoolNm: '법전중앙초등학교', schoolSe: '초등학교', rdnmadr: '경상북도 봉화군 법전면 법전로 135' });
    const n = neis({
      SD_SCHUL_CODE: '8961030', SCHUL_NM: '법전중앙초등학교', SCHUL_KND_SC_NM: '초등학교',
      ORG_RDNMA: '경상북도 봉화군 법전면 법전로 135 법전중앙초등학교', ORG_RDNDA: '',
    });
    expect(buildSchoolNeisMapping([s], [n]).mapping.get('B000007402')).toBe('8961030');
  });

  it('인천 행정구역 개편으로 시군구가 달라도 도로명으로 매핑한다', () => {
    const s = std({ schoolId: 'B000003149', schoolNm: '인천봉화초등학교', schoolSe: '초등학교', rdnmadr: '인천광역시 서구 건지로250번길 43' });
    const n = neis({
      SD_SCHUL_CODE: '7361018', SCHUL_NM: '인천봉화초등학교', SCHUL_KND_SC_NM: '초등학교',
      ORG_RDNMA: '인천광역시 서해구 건지로 250번길 43', ORG_RDNDA: '(가좌동, 봉화초등학교)',
    });
    expect(buildSchoolNeisMapping([s], [n]).mapping.get('B000003149')).toBe('7361018');
  });

  it('표준데이터에 도로명주소가 없으면 지번주소로 매핑한다', () => {
    const s = std({ schoolId: 'B000002449', schoolNm: '신선초등학교', schoolSe: '초등학교', rdnmadr: '', lnmadr: '부산광역시 영도구 신선동3가 산 1' });
    const n = neis({
      SD_SCHUL_CODE: '7171071', SCHUL_NM: '신선초등학교', SCHUL_KND_SC_NM: '초등학교',
      ORG_RDNMA: '부산광역시 영도구 산정길 17', ORG_RDNDA: '(신선동3가)',
    });
    // 도로명이 없으니 1단계는 실패하고 2단계(학교명+시도+시군구)로 매핑된다.
    const r = buildSchoolNeisMapping([s], [n]);
    expect(r.mapping.get('B000002449')).toBe('7171071');
    expect(r.stats.byName_region).toBe(1);
  });
});

describe('buildSchoolNeisMapping - 2단계 학교명 + 시/도 + 시군구', () => {
  it('주소 표기가 크게 달라도 시군구가 같으면 매핑한다', () => {
    const s = std({ schoolId: 'B000004641', schoolNm: '발곡초등학교', schoolSe: '초등학교', rdnmadr: '경기도 의정부시 동일로454번길 219-18' });
    const n = neis({
      SD_SCHUL_CODE: '7561025', SCHUL_NM: '발곡초등학교', SCHUL_KND_SC_NM: '초등학교',
      ORG_RDNMA: '경기도 의정부시 동일로454번길 , 74', ORG_RDNDA: '(신곡동)',
    });
    const r = buildSchoolNeisMapping([s], [n]);
    expect(r.mapping.get('B000004641')).toBe('7561025');
    expect(r.stats.byName_region).toBe(1);
  });

  it('같은 시군구에 동명이 둘이면 매핑하지 않는다', () => {
    const s = std({ schoolNm: '중앙초등학교', schoolSe: '초등학교', rdnmadr: '경기도 수원시 없는길 1' });
    const a = neis({ SD_SCHUL_CODE: '7011111', SCHUL_NM: '중앙초등학교', SCHUL_KND_SC_NM: '초등학교', ORG_RDNMA: '경기도 수원시 가길 1', ORG_RDNDA: '' });
    const b = neis({ SD_SCHUL_CODE: '7022222', SCHUL_NM: '중앙초등학교', SCHUL_KND_SC_NM: '초등학교', ORG_RDNMA: '경기도 수원시 나길 2', ORG_RDNDA: '' });
    const r = buildSchoolNeisMapping([s], [a, b]);
    expect(r.mapping.size).toBe(0);
    expect(r.stats.ambiguous).toBe(1);
  });
});

describe('buildSchoolNeisMapping - 3단계 도로명 + 학교급 (개명·통폐합)', () => {
  it('이름이 바뀌었어도 같은 주소·같은 학교급이면 매핑한다', () => {
    const s = std({ schoolId: 'B000007261', schoolNm: '대구송원초등학교', schoolSe: '초등학교', rdnmadr: '대구광역시 군위군 소보면 송백로 1394' });
    const n = neis({
      SD_SCHUL_CODE: '8862032', SCHUL_NM: '대구군위초등학교송원캠퍼스', SCHUL_KND_SC_NM: '초등학교',
      ORG_RDNMA: '대구광역시 군위군 소보면 송백로 1394', ORG_RDNDA: '',
    });
    const r = buildSchoolNeisMapping([s], [n]);
    expect(r.mapping.get('B000007261')).toBe('8862032');
    expect(r.stats.byRoad_level).toBe(1);
  });

  it('같은 주소에 학교급이 다른 학교가 있으면 학교급으로 구분한다', () => {
    const s = std({ schoolId: 'B000008769', schoolNm: '인천재능중학교', schoolSe: '중학교', rdnmadr: '인천광역시 동구 재능로 178' });
    const hs = neis({ SD_SCHUL_CODE: '7310627', SCHUL_NM: '재능고등학교', SCHUL_KND_SC_NM: '고등학교', ORG_RDNMA: '인천광역시 동구 재능로 178', ORG_RDNDA: '' });
    const ms = neis({ SD_SCHUL_CODE: '7321235', SCHUL_NM: '재능중학교', SCHUL_KND_SC_NM: '중학교', ORG_RDNMA: '인천광역시 동구 재능로 178', ORG_RDNDA: '' });
    expect(buildSchoolNeisMapping([s], [hs, ms]).mapping.get('B000008769')).toBe('7321235');
  });

  it('주소도 학교급도 같은 학교가 둘이면 매핑하지 않는다', () => {
    const s = std({ schoolSe: '초등학교', rdnmadr: '서울특별시 중구 같은길 1' });
    const a = neis({ SD_SCHUL_CODE: '7011111', SCHUL_NM: '가초등학교', SCHUL_KND_SC_NM: '초등학교', ORG_RDNMA: '서울특별시 중구 같은길 1', ORG_RDNDA: '' });
    const b = neis({ SD_SCHUL_CODE: '7022222', SCHUL_NM: '나초등학교', SCHUL_KND_SC_NM: '초등학교', ORG_RDNMA: '서울특별시 중구 같은길 1', ORG_RDNDA: '' });
    expect(buildSchoolNeisMapping([s], [a, b]).mapping.size).toBe(0);
  });
});

describe('buildSchoolNeisMapping - 안전 장치', () => {
  it('한 NEIS 코드에 표준 2건이 걸리면 양쪽 모두 폐기한다', () => {
    // 실측: 영천 금호중학교 2곳이 같은 코드로 수렴했다. 어느 쪽이 맞는지 알 수 없다.
    const a = std({ schoolId: 'B000010813', schoolNm: '금호중학교', schoolSe: '중학교', rdnmadr: '경상북도 영천시 금호읍 성천앞길 112-53' });
    const b = std({ schoolId: 'B000010814', schoolNm: '금호중학교', schoolSe: '중학교', rdnmadr: '경상북도 영천시 금호읍 교대길 8-18' });
    const n = neis({ SD_SCHUL_CODE: '8821066', SCHUL_NM: '금호중학교', SCHUL_KND_SC_NM: '중학교', ORG_RDNMA: '경상북도 영천시 금호읍 교대길 8-18', ORG_RDNDA: '' });
    const r = buildSchoolNeisMapping([a, b], [n]);
    expect(r.mapping.has('B000010813')).toBe(false);
    expect(r.mapping.has('B000010814')).toBe(false);
    expect(r.stats.droppedByCollision).toBe(2);
  });

  it('학교로 볼 수 없는 NEIS 레코드는 후보에서 제외한다', () => {
    const s = std({ schoolNm: '검정고시학교', rdnmadr: '서울특별시 중구 세종대로 1' });
    const bad = [
      neis({ SD_SCHUL_CODE: '', SCHUL_NM: '검정고시학교', ORG_RDNMA: '서울특별시 중구 세종대로 1', ORG_RDNDA: '' }),
      neis({ SD_SCHUL_CODE: '7010001', SCHUL_NM: '', ORG_RDNMA: '서울특별시 중구 세종대로 1', ORG_RDNDA: '' }),
      neis({ SD_SCHUL_CODE: '7010002', SCHUL_NM: '검정고시학교', SCHUL_KND_SC_NM: '', ORG_RDNMA: '서울특별시 중구 세종대로 1', ORG_RDNDA: '' }),
      neis({ SD_SCHUL_CODE: '7010003', SCHUL_NM: '서울시교육청 검정고시', ORG_RDNMA: '서울특별시 중구 세종대로 1', ORG_RDNDA: '' }),
      neis({ SD_SCHUL_CODE: '7010004', SCHUL_NM: '검정고시학교', ORG_RDNMA: '', ORG_RDNDA: '' }),
    ];
    expect(buildSchoolNeisMapping([s], bad).mapping.size).toBe(0);
  });

  it('빈 입력을 받아도 실패하지 않는다', () => {
    const r = buildSchoolNeisMapping([], []);
    expect(r.mapping.size).toBe(0);
    expect(r.stats.unmatched).toBe(0);
  });

  it('통계의 합이 입력 건수와 맞는다', () => {
    const matched = std({ schoolId: 'B000000001', rdnmadr: '서울특별시 중구 가길 1' });
    const none = std({ schoolId: 'B000000002', schoolNm: '없는학교', rdnmadr: '서울특별시 중구 나길 2' });
    const n = neis({ SD_SCHUL_CODE: '7010001', ORG_RDNMA: '서울특별시 중구 가길 1', ORG_RDNDA: '' });
    const r = buildSchoolNeisMapping([matched, none], [n]);
    const { byName_road, byName_region, byRoad_level, ambiguous, unmatched } = r.stats;
    expect(byName_road + byName_region + byRoad_level + ambiguous + unmatched).toBe(2);
  });
});
