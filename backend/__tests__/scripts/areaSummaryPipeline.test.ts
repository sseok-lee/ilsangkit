import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
const script = readFileSync(new URL('../../../scripts/ops/sync-real-estate.sh', import.meta.url), 'utf8');
const area = script.slice(script.indexOf('echo "[step:area-start]"'), script.indexOf('echo "[step:area-end]"'));
const aggregate = script.slice(script.indexOf('if [ "$REAL_ESTATE_SYNC_EXIT" -eq 0 ]'), script.indexOf('write_status "$REAL_ESTATE_SYNC_EXIT"'));
describe('일일 거래/V2/면적 단계 격리', () => {
  it('V2 뒤에 증분만 실행하고 별도 예산과 상태를 가진다', () => {
    expect(script.indexOf('[step:area-start]')).toBeGreaterThan(script.indexOf('[step:summary-end]'));
    expect(area).toContain('run_backend_node_timed 30m');
    expect(area).toContain('refreshRealEstateAreaSummary.js');
    expect(script).toContain('transaction_exit=%s\\nsummary_exit=%s\\narea_exit=%s');
    expect(script).not.toContain('backfillRealEstateAreaSummary.js');
  });
  it.each([0, 6, 124, 137])('면적 exit=%i여도 거래/V2 성공을 보존하고 종료 코드를 구분한다', (code) => {
    const result = execFileSync('bash', ['-c', `run_backend_node_timed() { return ${code}; }
ACTIVE_BACKEND_DIR=/unused
TRANSACTION_EXIT=0
SUMMARY_EXIT=0
REAL_ESTATE_SYNC_EXIT=0
${area}
${aggregate}
printf 'RESULT=%s,%s,%s,%s' "$TRANSACTION_EXIT" "$SUMMARY_EXIT" "$AREA_EXIT" "$REAL_ESTATE_SYNC_EXIT"`], { encoding: 'utf8' });
    expect(result).toContain(`RESULT=0,0,${code},${code ? 6 : 0}`);
  });
});
