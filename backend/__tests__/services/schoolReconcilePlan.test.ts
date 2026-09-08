import { describe, it, expect } from 'vitest';
import {
  planSchoolReconcile,
  buildRedirectMap,
  buildGoneList,
  collectAffectedSchoolIds,
  assertPlanInvariants,
  type SchoolRowState,
} from '../../src/services/schoolReconcilePlan.js';

/**
 * DB 학교 행을 NEIS 기준으로 정리하는 계획 수립.
 *
 * 링크 교정과 중복 제거는 분리할 수 없다. 링크만 고치면 표준행과 NEIS행이 같은
 * neisSchoolCode 를 물게 되고, PR #783 의 findMany(take:2) 모호 가드가 그 학교들을
 * 전부 건너뛴다(실측 1,378개). 그래서 한 번에 계획한다.
 *
 * 생존자는 표준행(B+9)을 택한다. school-B... URL 이 네이버 유입 89일 5,515뷰,
 * 즉 school 상세 전체의 76% 를 받고 있다(구글은 클릭 0).
 */

const std = (n: string, code: string | null = null): SchoolRowState => ({
  id: `school-B${n.padStart(9, '0')}`,
  sourceId: `B${n.padStart(9, '0')}`,
  neisSchoolCode: code,
});

const neisRow = (code: string): SchoolRowState => ({
  id: `school-${code}`,
  sourceId: code,
  neisSchoolCode: code,
});

describe('planSchoolReconcile - 링크 교정', () => {
  it('오연결된 표준행의 코드를 정본으로 바꾼다', () => {
    // 실제 사고: 서울 영등포 영신고가 대구 영신고 코드(7240097)에 걸려 있었다.
    const rows = [{ id: 'school-B000012035', sourceId: 'B000012035', neisSchoolCode: '7240097' }];
    const plan = planSchoolReconcile(rows, new Map([['B000012035', '7010100']]), new Set(['7010100', '7240097']));

    expect(plan.relink).toEqual([{ id: 'school-B000012035', from: '7240097', to: '7010100' }]);
    expect(plan.remove).toEqual([]);
  });

  it('링크가 없던 표준행을 연결한다', () => {
    const rows = [std('13453')];
    const plan = planSchoolReconcile(rows, new Map([['B000013453', '7010067']]), new Set(['7010067']));

    expect(plan.relink).toEqual([{ id: 'school-B000013453', from: null, to: '7010067' }]);
  });

  it('이미 맞는 링크는 건드리지 않는다', () => {
    const rows = [std('1838', '7021119')];
    const plan = planSchoolReconcile(rows, new Map([['B000001838', '7021119']]), new Set(['7021119']));

    expect(plan.relink).toEqual([]);
    expect(plan.remove).toEqual([]);
    expect(plan.unchanged).toEqual(['school-B000001838']);
  });

  it('NEIS 소유 행은 자기 코드로 링크를 채운다', () => {
    const rows = [{ id: 'school-7010999', sourceId: '7010999', neisSchoolCode: null }];
    const plan = planSchoolReconcile(rows, new Map(), new Set(['7010999']));

    expect(plan.relink).toEqual([{ id: 'school-7010999', from: null, to: '7010999' }]);
  });
});

describe('planSchoolReconcile - 중복 제거', () => {
  it('같은 학교의 표준행과 NEIS행이 있으면 표준행을 살리고 NEIS행을 301 한다', () => {
    // 라이브 실측 쌍: /school/school-B000013453 와 /school/school-7010067 이
    // 좌표 소수 7자리까지 같은 광양고등학교였다.
    const rows = [std('13453'), neisRow('7010067')];
    const plan = planSchoolReconcile(rows, new Map([['B000013453', '7010067']]), new Set(['7010067']));

    expect(plan.relink).toEqual([{ id: 'school-B000013453', from: null, to: '7010067' }]);
    expect(plan.remove).toEqual([
      { id: 'school-7010067', reason: 'duplicate', redirectTo: 'school-B000013453' },
    ]);
  });

  it('표준행이 이미 그 코드로 링크돼 있어도 중복을 제거한다', () => {
    const rows = [std('13453', '7010067'), neisRow('7010067')];
    const plan = planSchoolReconcile(rows, new Map([['B000013453', '7010067']]), new Set(['7010067']));

    expect(plan.relink).toEqual([]);
    expect(plan.remove.map((r) => r.id)).toEqual(['school-7010067']);
    expect(plan.unchanged).toEqual(['school-B000013453']);
  });

  it('NEIS행만 있으면 그대로 살린다', () => {
    const rows = [neisRow('7010067')];
    const plan = planSchoolReconcile(rows, new Map(), new Set(['7010067']));

    expect(plan.remove).toEqual([]);
    expect(plan.unchanged).toEqual(['school-7010067']);
  });

  it('표준행이 셋 이상 몰려도 하나만 살린다', () => {
    // 매퍼가 코드 충돌을 폐기하므로 정상적으로는 생기지 않지만, 계획 단계에서도 막는다.
    const rows = [std('1', '7010001'), std('2', '7010001'), neisRow('7010001')];
    const mapping = new Map([['B000000001', '7010001'], ['B000000002', '7010001']]);
    const plan = planSchoolReconcile(rows, mapping, new Set(['7010001']));

    const survivors = 1;
    expect(plan.remove.length).toBe(rows.length - survivors);
    expect(plan.remove.every((r) => r.redirectTo && r.redirectTo !== r.id)).toBe(true);
  });

  it('생존자로 리다이렉트가 자기 자신을 가리키지 않는다', () => {
    const rows = [std('13453'), neisRow('7010067')];
    const plan = planSchoolReconcile(rows, new Map([['B000013453', '7010067']]), new Set(['7010067']));

    for (const r of plan.remove) expect(r.redirectTo).not.toBe(r.id);
  });
});

describe('planSchoolReconcile - NEIS 에 없는 행 삭제', () => {
  it('매핑이 없는 표준행을 삭제 대상으로 올린다', () => {
    const rows = [std('2449')];
    const plan = planSchoolReconcile(rows, new Map(), new Set(['7010067']));

    expect(plan.remove).toEqual([
      { id: 'school-B000002449', reason: 'not-in-neis', redirectTo: null },
    ]);
    expect(plan.relink).toEqual([]);
  });

  it('코드가 NEIS 현재 목록에 없는 NEIS행을 삭제 대상으로 올린다', () => {
    // 실측: 학력인정 평생학교·공동실습소 36건이 NEIS 목록에서 사라졌다.
    const rows = [neisRow('7150434')];
    const plan = planSchoolReconcile(rows, new Map(), new Set(['7010067']));

    expect(plan.remove).toEqual([
      { id: 'school-7150434', reason: 'not-in-neis', redirectTo: null },
    ]);
  });

  it('매핑된 코드가 NEIS 목록에 없으면 삭제 대상으로 올린다', () => {
    const rows = [std('9999')];
    const plan = planSchoolReconcile(rows, new Map([['B000009999', '9999999']]), new Set(['7010067']));

    expect(plan.remove.map((r) => r.reason)).toEqual(['not-in-neis']);
  });

  it('삭제 대상은 리다이렉트를 만들지 않는다', () => {
    const rows = [std('2449'), neisRow('7150434')];
    const plan = planSchoolReconcile(rows, new Map(), new Set());

    expect(plan.remove.length).toBe(2);
    expect(plan.remove.every((r) => r.redirectTo === null)).toBe(true);
  });
});

describe('planSchoolReconcile - 불변식', () => {
  it('모든 행이 정확히 한 번 분류된다', () => {
    const rows: SchoolRowState[] = [
      std('1838', '7021119'),          // 유지
      std('12035', '7240097'),         // 교정
      std('13453'),                    // 신규 연결 + 중복 제거 유발
      neisRow('7010067'),              // 중복 삭제
      std('2449'),                     // 매핑 없음 → 삭제
      neisRow('7150434'),              // NEIS 목록에 없음 → 삭제
      neisRow('7010999'),              // NEIS 단독 유지
    ];
    const mapping = new Map([
      ['B000001838', '7021119'],
      ['B000012035', '7010100'],
      ['B000013453', '7010067'],
    ]);
    const live = new Set(['7021119', '7010100', '7010067', '7010999', '7240097']);

    const plan = planSchoolReconcile(rows, mapping, live);
    const classified = plan.relink.length + plan.remove.length + plan.unchanged.length;
    expect(classified).toBe(rows.length);

    const ids = [...plan.relink.map((r) => r.id), ...plan.remove.map((r) => r.id), ...plan.unchanged];
    expect(new Set(ids).size).toBe(rows.length);
  });

  it('계획 적용 후 살아남는 행의 neisSchoolCode 는 서로 겹치지 않는다', () => {
    const rows: SchoolRowState[] = [
      std('13453'), neisRow('7010067'),
      std('12035', '7240097'), neisRow('7010100'),
    ];
    const mapping = new Map([['B000013453', '7010067'], ['B000012035', '7010100']]);
    const live = new Set(['7010067', '7010100', '7240097']);

    const plan = planSchoolReconcile(rows, mapping, live);
    const removed = new Set(plan.remove.map((r) => r.id));
    const relinked = new Map(plan.relink.map((r) => [r.id, r.to]));

    const codes = rows
      .filter((r) => !removed.has(r.id))
      .map((r) => relinked.get(r.id) ?? r.neisSchoolCode);
    expect(codes.every(Boolean)).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('빈 입력을 받아도 실패하지 않는다', () => {
    const plan = planSchoolReconcile([], new Map(), new Set());
    expect(plan).toEqual({ relink: [], remove: [], unchanged: [] });
  });
});

describe('buildRedirectMap - 중복 삭제 행의 301 매핑', () => {
  it('중복 삭제만 리다이렉트 매핑에 넣는다', () => {
    const plan = {
      relink: [],
      remove: [
        { id: 'school-7010067', reason: 'duplicate' as const, redirectTo: 'school-B000013453' },
        { id: 'school-7150434', reason: 'not-in-neis' as const, redirectTo: null },
      ],
      unchanged: [],
    };
    expect(buildRedirectMap(plan)).toEqual({ 'school-7010067': 'school-B000013453' });
  });

  it('빈 계획이면 빈 객체를 반환한다', () => {
    expect(buildRedirectMap({ relink: [], remove: [], unchanged: [] })).toEqual({});
  });
});

describe('buildGoneList - 410 대상', () => {
  it('NEIS 에 없는 행만 410 목록에 넣고 정렬한다', () => {
    const plan = {
      relink: [],
      remove: [
        { id: 'school-7150436', reason: 'not-in-neis' as const, redirectTo: null },
        { id: 'school-7010067', reason: 'duplicate' as const, redirectTo: 'school-B000013453' },
        { id: 'school-7150434', reason: 'not-in-neis' as const, redirectTo: null },
      ],
      unchanged: [],
    };
    expect(buildGoneList(plan)).toEqual(['school-7150434', 'school-7150436']);
  });
});

describe('collectAffectedSchoolIds - 연관 행을 버릴 학교', () => {
  it('링크가 바뀌거나 삭제되는 학교를 모은다', () => {
    // 오연결이던 학교의 학급·학과는 남의 학교 것이므로 버리고 sync 로 다시 채운다.
    const plan = {
      relink: [{ id: 'school-B000012035', from: '7240097', to: '7010100' }],
      remove: [
        { id: 'school-7010067', reason: 'duplicate' as const, redirectTo: 'school-B000013453' },
        { id: 'school-7150434', reason: 'not-in-neis' as const, redirectTo: null },
      ],
      unchanged: ['school-B000001838'],
    };
    expect(collectAffectedSchoolIds(plan).sort()).toEqual(
      ['school-7010067', 'school-7150434', 'school-B000012035'].sort()
    );
  });

  it('변경 없는 학교는 포함하지 않는다', () => {
    const plan = { relink: [], remove: [], unchanged: ['school-B000001838'] };
    expect(collectAffectedSchoolIds(plan)).toEqual([]);
  });
});

describe('assertPlanInvariants - 적용 전 안전 검사', () => {
  const rows: SchoolRowState[] = [std('13453'), neisRow('7010067'), std('2449')];
  const mapping = new Map([['B000013453', '7010067']]);
  const live = new Set(['7010067']);

  it('정상 계획은 통과한다', () => {
    const plan = planSchoolReconcile(rows, mapping, live);
    expect(() => assertPlanInvariants(rows, plan)).not.toThrow();
  });

  it('분류 합계가 입력 건수와 다르면 던진다', () => {
    const plan = planSchoolReconcile(rows, mapping, live);
    plan.unchanged.push('school-B999999999');
    expect(() => assertPlanInvariants(rows, plan)).toThrow(/분류/);
  });

  it('같은 행이 두 번 분류되면 던진다', () => {
    const plan = planSchoolReconcile(rows, mapping, live);
    plan.unchanged.pop();
    plan.unchanged.push(plan.remove[0].id);
    expect(() => assertPlanInvariants(rows, plan)).toThrow(/중복 분류|분류/);
  });

  it('301 타깃이 삭제되는 행이면 던진다', () => {
    const plan = planSchoolReconcile(rows, mapping, live);
    plan.remove[0].redirectTo = plan.remove[1]?.id ?? 'school-B000002449';
    expect(() => assertPlanInvariants(rows, plan)).toThrow(/리다이렉트/);
  });

  it('적용 후 생존 행의 코드가 겹치면 던진다', () => {
    const dupRows: SchoolRowState[] = [
      { id: 'school-B000000001', sourceId: 'B000000001', neisSchoolCode: '7010001' },
      { id: 'school-B000000002', sourceId: 'B000000002', neisSchoolCode: '7010001' },
    ];
    const plan = { relink: [], remove: [], unchanged: dupRows.map((r) => r.id) };
    expect(() => assertPlanInvariants(dupRows, plan)).toThrow(/겹친다/);
  });
});
