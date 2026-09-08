/**
 * 표준데이터 학교ID ↔ NEIS SD_SCHUL_CODE 매핑.
 *
 * ## 왜 필요한가
 *
 * mergeSchoolNeis 는 NEIS 를 학교명만으로 매칭했다 — `Map.set(n.name, n)` 이라 동명 그룹에서
 * 마지막 하나가 모든 동명 학교에 붙는다. 실측하면 학교명 단독 매칭은 다중 후보가 2,592건이고,
 * 그 결과 표준행 940건에 남의 학교 코드가 박혔다. 이후 syncSchoolNeis 가 그 링크를 따라
 * 지역·주소·전화를 계속 덮어써, 좌표는 서울인데 주소는 대구인 행이 되고 같은 학교가
 * 지역을 달리해 2페이지로 노출됐다.
 *
 * 학교명에 도로명·건물번호를 더하면 다중 후보가 **0건**이 된다. 그것이 이 모듈의 존재 이유다.
 *
 * ## 매칭 단계 (각 단계는 후보가 정확히 1건일 때만 채택한다)
 *
 *   1. 학교명 + 도로명·건물번호   — 가장 강함. 실측 11,783건
 *   2. 학교명 + 시/도 + 시군구     — 주소 표기가 크게 다를 때. 실측 107건
 *   3. 도로명·건물번호 + 학교급    — 개명·통폐합으로 이름이 바뀐 학교. 실측 59건
 *
 * `학교명 + 시/도` 단독 단계는 두지 않는다. 안산 초당초와 용인 초당초처럼 같은 시/도의
 * 동명 학교를 엉뚱하게 묶어 실측에서 오연결 3건을 만들었고, 얻는 매칭은 8건뿐이었다.
 *
 * ## 주소 정규화 (두 소스의 표기 차이가 매칭의 전부다 — 모두 실측된 차이다)
 *
 *   - NEIS 는 도로명 뒤에 학교명을 덧붙인다     "법전로 135 법전중앙초등학교"
 *   - NEIS 는 번길을 쉼표로 쪼갠다               "금화로 105 , 33" = 금화로105번길 33
 *   - NEIS 는 번길 앞에 공백을 넣는다            "건지로 250번길" vs "건지로250번길"
 *   - 중점 문자가 다르다                         "이화·금란" vs "이화・금란"
 *   - 표준데이터에 도로명주소가 빈 레코드가 있다 → 지번주소로 폴백
 *
 * 표준데이터는 2026 인천 개편을 반영하지 않아 시군구가 서구/중구/동구인데 NEIS 는
 * 서해구/검단구/영종구/제물포구다. 1단계가 시군구를 키에 넣지 않는 이유가 이것이다.
 */

/** 매칭에 필요한 표준데이터 필드만. tn_ API 응답과 CSV 파싱 결과 모두 이 형태로 맞춘다. */
export interface MatchableStandardSchool {
  schoolId: string;
  schoolNm: string;
  schoolSe: string;
  rdnmadr?: string | null;
  lnmadr?: string | null;
}

/** 매칭에 필요한 NEIS 필드만. */
export interface MatchableNeisSchool {
  SD_SCHUL_CODE: string;
  SCHUL_NM: string;
  SCHUL_KND_SC_NM: string;
  ORG_RDNMA?: string | null;
  ORG_RDNDA?: string | null;
}

export interface MappingStats {
  /** 1단계: 학교명 + 도로명 */
  byName_road: number;
  /** 2단계: 학교명 + 시/도 + 시군구 */
  byName_region: number;
  /** 3단계: 도로명 + 학교급 (개명·통폐합) */
  byRoad_level: number;
  /** 어느 단계에서도 후보가 2건 이상이라 채택하지 못함 */
  ambiguous: number;
  /** 후보가 없음 (폐교·개명 추정) */
  unmatched: number;
  /** 한 NEIS 코드에 표준 2건 이상이 수렴해 폐기 */
  droppedByCollision: number;
}

export interface MappingResult {
  /** 표준데이터 학교ID → NEIS SD_SCHUL_CODE */
  mapping: Map<string, string>;
  stats: MappingStats;
}

/** 중점 문자는 소스마다 다르게 들어온다(U+00B7 / U+30FB / U+2022 / U+2027 / U+2219). */
const MIDDLE_DOTS = /[·・‧∙•]/g;

export function normalizeSchoolName(name?: string | null): string {
  return (name ?? '')
    .trim()
    .replace(MIDDLE_DOTS, '·')
    .replace(/\s+/g, '')
    .replace(/\(폐교\)$/, '');
}

/**
 * 주소에서 도로명 + 건물번호만 뽑는다. 시/도·시군구·읍면동 표기 차이에 영향받지 않는다.
 * 도로명·건물번호를 찾지 못하면 빈 문자열(= 이 키로는 매칭하지 않음).
 */
export function extractRoadKey(address?: string | null, schoolName?: string | null): string {
  let a = (address ?? '').replace(/\([^)]*\)/g, ' ');

  // NEIS 는 도로명 뒤에 학교명을 덧붙인다.
  const nm = (schoolName ?? '').trim();
  if (nm) a = a.split(nm).join(' ');

  a = a.replace(/\s+/g, ' ').trim();

  // NEIS 가 번길을 쉼표로 쪼갠 형태를 복원한다: "금화로 105 , 33" → "금화로105번길 33"
  a = a.replace(/([가-힣A-Za-z0-9]*(?:대로|로|길))\s+(\d+)\s*,\s*(\d+[\d-]*)/, '$1$2번길 $3');
  a = a.replace(/\s*,\s*/g, ' ');
  // "건지로 250번길" → "건지로250번길"
  a = a.replace(/(대로|로|길)\s+(\d+)(번안길|번길)/g, '$1$2$3');

  const m = a.match(/([가-힣A-Za-z0-9]*(?:대로|로|길))\s*(\d+[\d-]*)/);
  if (!m) return '';
  return (m[1] + m[2]).replace(/\s+/g, '');
}

/** 시/도 접미를 떼어 두 소스의 표기를 맞춘다. */
export function normalizeSidoName(sido?: string | null): string {
  return (sido ?? '')
    .trim()
    .replace(/통합특별시$/, '')
    .replace(/특별자치시$|특별자치도$|특별시$|광역시$/, '')
    .replace(/도$/, '');
}

function schoolLevelKey(kind?: string | null): string {
  const k = (kind ?? '').trim();
  if (k.includes('초등')) return '초';
  if (k.includes('중학')) return '중';
  if (k.includes('고등')) return '고';
  return k;
}

interface NeisCandidate {
  code: string;
  nameKey: string;
  roadKey: string;
  sido: string;
  sgg: string;
  level: string;
}

/** syncSchoolNeis 와 같은 기준으로 학교로 볼 수 없는 레코드를 걸러낸다. */
function toCandidate(r: MatchableNeisSchool): NeisCandidate | null {
  const code = (r.SD_SCHUL_CODE ?? '').trim();
  const name = (r.SCHUL_NM ?? '').trim();
  const kind = (r.SCHUL_KND_SC_NM ?? '').trim();
  if (!code || !name || !kind || name.includes('검정고시')) return null;

  const road = [(r.ORG_RDNMA ?? '').trim(), (r.ORG_RDNDA ?? '').trim()].filter(Boolean).join(' ');
  if (!road) return null;

  const tokens = road.replace(/\([^)]*\)/g, ' ').trim().split(/\s+/);
  return {
    code,
    nameKey: normalizeSchoolName(name),
    roadKey: extractRoadKey(road, name),
    sido: normalizeSidoName(tokens[0]),
    sgg: tokens[1] ?? '',
    level: schoolLevelKey(kind),
  };
}

function pushIndex(map: Map<string, NeisCandidate[]>, key: string, value: NeisCandidate): void {
  if (!key) return;
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * 표준데이터와 NEIS 를 3단계로 매칭한다. 각 단계는 후보가 정확히 1건일 때만 채택하고,
 * 한 NEIS 코드에 표준 2건 이상이 수렴하면 어느 쪽이 맞는지 알 수 없으므로 양쪽 모두 폐기한다.
 */
export function buildSchoolNeisMapping(
  standard: MatchableStandardSchool[],
  neis: MatchableNeisSchool[]
): MappingResult {
  const candidates: NeisCandidate[] = [];
  for (const r of neis) {
    const c = toCandidate(r);
    if (c) candidates.push(c);
  }

  const byNameRoad = new Map<string, NeisCandidate[]>();
  const byNameRegion = new Map<string, NeisCandidate[]>();
  const byRoadLevel = new Map<string, NeisCandidate[]>();
  for (const c of candidates) {
    pushIndex(byNameRoad, c.nameKey && c.roadKey ? `${c.nameKey}|${c.roadKey}` : '', c);
    pushIndex(byNameRegion, c.nameKey && c.sido && c.sgg ? `${c.nameKey}|${c.sido}|${c.sgg}` : '', c);
    pushIndex(byRoadLevel, c.roadKey && c.level ? `${c.roadKey}|${c.level}` : '', c);
  }

  const mapping = new Map<string, string>();
  const stats: MappingStats = {
    byName_road: 0,
    byName_region: 0,
    byRoad_level: 0,
    ambiguous: 0,
    unmatched: 0,
    droppedByCollision: 0,
  };
  // 폐기 시 통계를 되돌리기 위해 어느 단계에서 채택했는지 기억한다.
  const tierOf = new Map<string, keyof MappingStats>();

  for (const s of standard) {
    const nameKey = normalizeSchoolName(s.schoolNm);
    // 표준데이터에는 도로명주소가 빈 레코드가 있다 → 지번주소로 폴백.
    const address = (s.rdnmadr ?? '').trim() || (s.lnmadr ?? '').trim();
    const roadKey = extractRoadKey(address, s.schoolNm);
    const tokens = address.split(/\s+/);
    const sido = normalizeSidoName(tokens[0]);
    const sgg = tokens[1] ?? '';
    const level = schoolLevelKey(s.schoolSe);

    const attempts: Array<[keyof MappingStats, Map<string, NeisCandidate[]>, string]> = [
      ['byName_road', byNameRoad, nameKey && roadKey ? `${nameKey}|${roadKey}` : ''],
      ['byName_region', byNameRegion, nameKey && sido && sgg ? `${nameKey}|${sido}|${sgg}` : ''],
      ['byRoad_level', byRoadLevel, roadKey && level ? `${roadKey}|${level}` : ''],
    ];

    let hit: NeisCandidate | null = null;
    let tier: keyof MappingStats | null = null;
    let sawAmbiguous = false;
    for (const [name, index, key] of attempts) {
      if (!key) continue;
      const found = index.get(key);
      if (!found) continue;
      if (found.length === 1) {
        hit = found[0];
        tier = name;
        break;
      }
      sawAmbiguous = true;
    }

    if (hit && tier) {
      mapping.set(s.schoolId, hit.code);
      tierOf.set(s.schoolId, tier);
      stats[tier]++;
    } else if (sawAmbiguous) {
      stats.ambiguous++;
    } else {
      stats.unmatched++;
    }
  }

  // 한 NEIS 코드에 표준 2건 이상이 걸리면 양쪽 모두 폐기한다.
  const byCode = new Map<string, string[]>();
  for (const [schoolId, code] of mapping) {
    const list = byCode.get(code);
    if (list) list.push(schoolId);
    else byCode.set(code, [schoolId]);
  }
  for (const [, schoolIds] of byCode) {
    if (schoolIds.length < 2) continue;
    for (const schoolId of schoolIds) {
      const tier = tierOf.get(schoolId);
      if (tier) stats[tier]--;
      mapping.delete(schoolId);
      stats.droppedByCollision++;
    }
  }

  return { mapping, stats };
}
