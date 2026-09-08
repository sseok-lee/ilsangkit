import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 표준데이터 CSV 로 학교 행을 적재하는 경로는 은퇴했다.
 *
 * ## 왜
 *
 * NEIS 가 학교의 단일 소스다(#789). `sync:school:csv` 를 한 번 돌리면
 * `batchUpsertRaw` 가 표준 sourceId 행 12,014건을 CSV 값으로 덮어써서:
 *
 *   - 표준행 10,879건의 신원이 referenceDate 2026-03-20 값으로 되돌아간다
 *   - 2026 인천 행정구역 개편이 회귀한다 (표준데이터는 제물포·영종·서해·검단구 0건,
 *     NEIS 기준으로 교정해 놓은 167건이 중·동·서구로 돌아간다)
 *   - NEIS 에 없어 410 처리한 학교가 되살아날 수 있다
 *
 * 사고를 만든 mergeSchoolNeis 는 #789 에서 이미 은퇴했다. 이 경로는 그때
 * "#783 과 무관하게 원래 위험했고 이 PR 이 키우지 않는다"는 이유로 남겨 뒀는데,
 * 신원 쓰기가 복구된 지금은 남겨둘 이유가 없다.
 *
 * ## 남기는 것
 *
 * `parseSchoolCSV` 는 남긴다 — reconcileSchoolNeisRows 가 학교ID ↔ NEIS 코드 매핑
 * 입력으로 읽는다(로컬 CSV 라 네트워크 없이 재현되고 매칭률이 가장 높다: 99.30%).
 * 파서는 읽기만 하므로 DB 를 되돌릴 수 없다.
 *
 * 반면 `transformSchoolRow` 는 CSV 행을 School 행 형태로 바꾸는 함수라 적재 경로
 * 전용이다. 호출자가 사라지면 죽은 코드이자 은퇴한 소유권 모델을 코드에 남겨두는
 * 함정이므로 함께 지운다.
 */

const BACKEND = path.resolve(import.meta.dirname, '../..');

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(BACKEND, rel), 'utf-8'));
}

describe('표준데이터 CSV 학교 적재 경로 은퇴', () => {
  it('sync:school:csv npm 스크립트가 없다', () => {
    const pkg = readJson('package.json');
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    expect(Object.keys(scripts)).not.toContain('sync:school:csv');
  });

  it('CSV 로 School 을 적재하는 스크립트·서비스 파일이 없다', () => {
    expect(fs.existsSync(path.join(BACKEND, 'src/scripts/syncSchool.ts'))).toBe(false);
    expect(fs.existsSync(path.join(BACKEND, 'src/services/schoolSyncService.ts'))).toBe(false);
  });

  it('어떤 sync 스크립트도 syncSchools(CSV 적재)를 호출하지 않는다', () => {
    // syncSchoolsNeis 는 이름이 겹치므로 단어 경계로 구분한다.
    const dir = path.join(BACKEND, 'src/scripts');
    const offenders = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => /\bsyncSchools\b(?!Neis)/.test(fs.readFileSync(path.join(dir, f), 'utf-8')));
    expect(offenders).toEqual([]);
  });

  it('csvParser 가 transformSchoolRow 를 더 이상 내보내지 않는다', () => {
    const code = fs.readFileSync(path.join(BACKEND, 'src/services/csvParser.ts'), 'utf-8');
    expect(code).not.toContain('transformSchoolRow');
  });

  it('parseSchoolCSV 는 남아 있다 — reconcile 의 매핑 입력', () => {
    // 이게 사라지면 reconcileSchoolNeisRows 가 뜨지 않는다.
    const code = fs.readFileSync(path.join(BACKEND, 'src/services/csvParser.ts'), 'utf-8');
    expect(code).toContain('export async function parseSchoolCSV');

    const reconcile = fs.readFileSync(
      path.join(BACKEND, 'src/scripts/reconcileSchoolNeisRows.ts'),
      'utf-8'
    );
    expect(reconcile).toContain('parseSchoolCSV');
  });

  it('학교 sync 로 남는 npm 스크립트는 NEIS 경로뿐이다', () => {
    const pkg = readJson('package.json');
    const scripts = (pkg.scripts ?? {}) as Record<string, string>;
    const schoolScripts = Object.keys(scripts).filter((k) => k.startsWith('sync:school'));
    expect(schoolScripts.sort()).toEqual([
      'sync:school',
      'sync:school:department',
      'sync:school:enrollment',
      'sync:school:geocode',
    ]);
  });
});
