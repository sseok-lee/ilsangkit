/**
 * DB 학교 행을 NEIS 기준으로 정리하는 계획 수립 (순수 함수, DB 접근 없음).
 *
 * ## 왜 한 번에 계획하는가
 *
 * 링크 교정과 중복 제거는 분리할 수 없다. 링크만 고치면 표준행과 NEIS행이 같은
 * neisSchoolCode 를 물게 되고, PR #783 의 findMany(take:2) 모호 가드가 그 학교들을
 * 전부 건너뛴다(실측 1,378개). 그래서 링크·중복·삭제를 한 계획으로 낸다.
 *
 * ## 생존자 선택
 *
 * 같은 학교의 행이 여럿이면 표준행(sourceId = 'B'+9자리)을 살린다. school-B... URL 이
 * 네이버 유입 89일 5,515뷰 — school 상세 전체의 76% 를 받고 있다(구글은 클릭 0).
 * 삭제되는 행은 생존 행으로 301 한다.
 *
 * ## NEIS 에 없으면 삭제
 *
 * NEIS 현재 목록에 대응 레코드가 없는 행은 삭제한다(사용자 결정). NEIS 는 학교가 직접
 * 보고하는 운영 시스템이라 폐교·통폐합이 목록에서 빠진다. 실측 125건 — 매핑 없는
 * 표준행 89건(폐교·개명 추정)과 코드가 사라진 NEIS행 36건(학력인정 평생학교·공동실습소).
 * 이 행들은 대응 학교가 없으므로 리다이렉트 대상이 없다 → 410 으로 처리한다.
 */

export interface SchoolRowState {
  id: string;
  sourceId: string;
  neisSchoolCode: string | null;
}

export interface RelinkAction {
  id: string;
  from: string | null;
  to: string;
}

export interface RemoveAction {
  id: string;
  reason: 'duplicate' | 'not-in-neis';
  /** 중복이면 생존 행의 id(301 대상), NEIS 에 없으면 null(410 대상). */
  redirectTo: string | null;
}

export interface ReconcilePlan {
  relink: RelinkAction[];
  remove: RemoveAction[];
  /** 손댈 것이 없는 행의 id. */
  unchanged: string[];
}

/** 표준데이터 학교ID = 'B' + 9자리. 원본 12,014건 전부 이 형식(예외 0건). */
function isStandardDataSourceId(sourceId: string): boolean {
  return /^B\d{9}$/.test(sourceId?.trim() ?? '');
}

/**
 * 이 행이 어느 NEIS 코드에 속하는지. 속할 코드가 없으면 null(= 삭제 대상).
 *
 * 표준행은 매퍼가 준 매핑을 따르고, NEIS 소유 행은 자기 sourceId 가 코드다.
 * 어느 쪽이든 그 코드가 NEIS 현재 목록에 없으면 null 이다.
 */
function resolveTargetCode(
  row: SchoolRowState,
  mapping: Map<string, string>,
  liveNeisCodes: Set<string>
): string | null {
  const code = isStandardDataSourceId(row.sourceId)
    ? mapping.get(row.sourceId) ?? null
    : row.sourceId;
  if (!code || !liveNeisCodes.has(code)) return null;
  return code;
}

/**
 * 같은 코드에 몰린 행 중 살릴 하나를 고른다. 표준행 우선, 그다음 id 순서로 결정적으로.
 */
function pickSurvivor(rows: SchoolRowState[]): SchoolRowState {
  const sorted = [...rows].sort((a, b) => {
    const aStd = isStandardDataSourceId(a.sourceId) ? 0 : 1;
    const bStd = isStandardDataSourceId(b.sourceId) ? 0 : 1;
    if (aStd !== bStd) return aStd - bStd;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return sorted[0];
}

export function planSchoolReconcile(
  rows: SchoolRowState[],
  mapping: Map<string, string>,
  liveNeisCodes: Set<string>
): ReconcilePlan {
  const plan: ReconcilePlan = { relink: [], remove: [], unchanged: [] };

  const byCode = new Map<string, SchoolRowState[]>();
  for (const row of rows) {
    const code = resolveTargetCode(row, mapping, liveNeisCodes);
    if (!code) {
      plan.remove.push({ id: row.id, reason: 'not-in-neis', redirectTo: null });
      continue;
    }
    const list = byCode.get(code);
    if (list) list.push(row);
    else byCode.set(code, [row]);
  }

  for (const [code, group] of byCode) {
    const survivor = pickSurvivor(group);

    for (const row of group) {
      if (row.id !== survivor.id) {
        plan.remove.push({ id: row.id, reason: 'duplicate', redirectTo: survivor.id });
      }
    }

    if (survivor.neisSchoolCode === code) {
      plan.unchanged.push(survivor.id);
    } else {
      plan.relink.push({ id: survivor.id, from: survivor.neisSchoolCode, to: code });
    }
  }

  return plan;
}

/**
 * 중복으로 삭제되는 행 → 생존 행의 301 매핑.
 * frontend `server/data/facilityRedirects.json` 에 합칠 형태(시설 id → 시설 id)다.
 */
export function buildRedirectMap(plan: ReconcilePlan): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of plan.remove) {
    if (r.reason === 'duplicate' && r.redirectTo) map[r.id] = r.redirectTo;
  }
  return map;
}

/**
 * NEIS 에 대응 학교가 없어 삭제되는 행의 id — 410 Gone 대상.
 * 갈 곳이 없으므로 301 하지 않는다.
 */
export function buildGoneList(plan: ReconcilePlan): string[] {
  return plan.remove
    .filter((r) => r.reason === 'not-in-neis')
    .map((r) => r.id)
    .sort();
}

/**
 * 학급(SchoolEnrollment)·학과(SchoolDepartment) 데이터를 버려야 하는 학교 id.
 *
 * 두 sync 는 neisSchoolCode 로 NEIS 를 조회한다. 링크가 틀렸던 학교의 학급·학과는
 * 남의 학교 것이므로 버리고 sync 로 다시 채운다. 삭제되는 행의 자식은 FK 때문에도
 * 먼저 지워야 한다(SchoolEnrollment·SchoolDepartment 는 onDelete 미지정 = RESTRICT).
 */
export function collectAffectedSchoolIds(plan: ReconcilePlan): string[] {
  return [...plan.relink.map((r) => r.id), ...plan.remove.map((r) => r.id)];
}

/**
 * 적용 전 안전 검사. 하나라도 어긋나면 던져서 쓰기를 막는다.
 */
export function assertPlanInvariants(rows: SchoolRowState[], plan: ReconcilePlan): void {
  const ids = [...plan.relink.map((r) => r.id), ...plan.remove.map((r) => r.id), ...plan.unchanged];

  if (ids.length !== rows.length) {
    throw new Error(`분류 합계 불일치: 입력 ${rows.length} != 분류 ${ids.length}`);
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error('중복 분류: 같은 행이 두 번 이상 분류됐다');
  }
  const inputIds = new Set(rows.map((r) => r.id));
  for (const id of ids) {
    if (!inputIds.has(id)) throw new Error(`입력에 없는 행이 분류됐다: ${id}`);
  }

  const removed = new Set(plan.remove.map((r) => r.id));
  for (const r of plan.remove) {
    if (r.redirectTo === null) continue;
    if (r.redirectTo === r.id) throw new Error(`리다이렉트가 자기 자신을 가리킨다: ${r.id}`);
    if (removed.has(r.redirectTo)) {
      throw new Error(`리다이렉트 타깃이 삭제 대상이다: ${r.id} → ${r.redirectTo}`);
    }
    if (!inputIds.has(r.redirectTo)) {
      throw new Error(`리다이렉트 타깃이 존재하지 않는다: ${r.id} → ${r.redirectTo}`);
    }
  }

  // 적용 후 생존 행의 neisSchoolCode 가 전부 채워지고 서로 겹치지 않아야 한다.
  const relinked = new Map(plan.relink.map((r) => [r.id, r.to]));
  const survivorCodes: string[] = [];
  for (const row of rows) {
    if (removed.has(row.id)) continue;
    const code = relinked.get(row.id) ?? row.neisSchoolCode;
    if (!code) throw new Error(`생존 행에 코드가 없다: ${row.id}`);
    survivorCodes.push(code);
  }
  if (new Set(survivorCodes).size !== survivorCodes.length) {
    throw new Error('적용 후 생존 행의 neisSchoolCode 가 겹친다');
  }
}
