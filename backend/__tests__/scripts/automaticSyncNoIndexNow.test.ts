import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 자동 sync 경로는 IndexNow 에 제출하지 않는다.
 *
 * ## 왜
 *
 * 제출 대상을 `syncedAt >= now-2h` 로 골랐다. syncedAt 은 "원본에서 확인한 시각"이라
 * 내용이 바뀌지 않아도 매 실행 갱신되므로(updatedAt 과 의미 분리, PR#690), 사실상
 * 동기화된 전량을 매번 다시 제출했다. 학교를 NEIS 단일 소스로 바꾸며 표준행에도
 * syncedAt 을 찍게 되자 school 제출량이 1,628 → 12,540/회 로 뛰었고, 이 구조가
 * 카테고리마다 같다는 게 드러났다.
 *
 * 크롤 예산은 이 사이트의 핵심 제약이다. 부동산 sync 가 하루 4.5~7.9만 건을 제출해
 * 크롤 능력의 7~12배를 밀어넣던 것을 PR#749/#763 으로 걷어냈고, 2026-09-03 측정에서
 * IndexNow 가 크롤 배분을 움직이지 않는다는 반증까지 나왔다(재요청비·인접일 교집합이
 * 제출 중단 전후 동일 = 네이버는 사이트맵 순회로 돈다). 무변경 페이지 재제출은
 * 이득이 없고 비용만 남는다.
 *
 * ## 무엇이 남는가
 *
 * `indexNowService` 와 `submitIndexNowBackfill.ts` 는 남긴다. 백필은 화석 색인 세척처럼
 * 사람이 대상과 건수를 정해 1회 실행하는 경로이므로 여기서 말하는 자동 재제출이 아니다.
 *
 * 주석 처리된 import 는 통과시킨다 — 부동산 sync 들이 그 형태로 이미 비활성화돼 있고,
 * 되살리려면 주석을 풀어야 하므로 이 테스트가 그 순간 잡는다.
 */

const SCRIPTS_DIR = path.resolve(import.meta.dirname, '../../src/scripts');

// 자동 제출로 간주하는 호출. 서비스 자체가 아니라 "sync 스크립트가 호출하는가"를 본다.
const SUBMIT_CALLS = ['submitIndexNow', 'submitNewlyTransactedBuildings'];

/** 줄 주석과 블록 주석을 걷어낸다 — 비활성화된 import 를 위반으로 세지 않기 위해. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

function syncScriptFiles(): string[] {
  return fs
    .readdirSync(SCRIPTS_DIR)
    .filter((f) => f.startsWith('sync') && f.endsWith('.ts'))
    .sort();
}

describe('자동 sync 경로는 IndexNow 를 제출하지 않는다', () => {
  it('sync*.ts 중 어느 것도 IndexNow 제출을 호출하지 않는다', () => {
    const offenders: string[] = [];

    for (const file of syncScriptFiles()) {
      const code = stripComments(fs.readFileSync(path.join(SCRIPTS_DIR, file), 'utf-8'));
      for (const call of SUBMIT_CALLS) {
        if (code.includes(call)) offenders.push(`${file} → ${call}`);
      }
    }

    expect(offenders, 'sync 스크립트는 IndexNow 를 제출하면 안 된다').toEqual([]);
  });

  it('검사 대상이 실제로 존재한다 (빈 목록으로 공허하게 통과하지 않는다)', () => {
    const files = syncScriptFiles();
    expect(files.length).toBeGreaterThan(20);
    expect(files).toContain('syncAll.ts');
    expect(files).toContain('syncSports.ts');
    expect(files).toContain('syncChildcare.ts');
    expect(files).toContain('syncEvCharger.ts');
  });

  it('수동 백필은 제외 대상이다 — 여전히 제출한다', () => {
    // 이 파일이 제출을 잃으면 화석 색인 세척 경로가 사라진 것이므로 알아야 한다.
    const code = stripComments(
      fs.readFileSync(path.join(SCRIPTS_DIR, 'submitIndexNowBackfill.ts'), 'utf-8')
    );
    expect(code).toContain('submitIndexNow');
  });

  it('백필은 sync*.ts 이름 규칙에 걸리지 않는다', () => {
    // 이름이 바뀌어 검사 대상에 들어오면 위 테스트가 서로 모순되므로 미리 고정한다.
    expect(syncScriptFiles()).not.toContain('submitIndexNowBackfill.ts');
  });
});
