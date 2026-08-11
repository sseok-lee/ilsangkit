import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import * as iconv from 'iconv-lite';
import {
  validateCsvBuffer,
  ensureLatestLocaldataCsvs,
  type LocaldataFileSpec,
} from '../../src/services/localdataFileDownloader.js';

const HEADER = '개방자치단체코드,관리번호,화장실명,소재지도로명주소';

function csvBuffer(rows: number, encoding: 'utf8' | 'euc-kr' = 'utf8'): Buffer {
  const lines = [HEADER];
  for (let i = 0; i < rows; i++) {
    lines.push(`3000000,MNG-${i},화장실${i},서울시 중구 세종대로 ${i}`);
  }
  const text = lines.join('\n');
  return encoding === 'utf8' ? Buffer.from(text, 'utf-8') : iconv.encode(text, 'euc-kr');
}

function makeSpec(dir: string, overrides: Partial<LocaldataFileSpec> = {}): LocaldataFileSpec {
  return {
    category: 'toilet',
    service: 'public_restroom_info',
    targetPath: path.join(dir, 'toilet.csv'),
    requiredHeaders: ['개방자치단체코드', '관리번호', '화장실명'],
    minRows: 3,
    ...overrides,
  };
}

describe('validateCsvBuffer', () => {
  const spec = makeSpec('/tmp');

  it('UTF-8 CSV의 필수 헤더와 행 수를 통과시킨다', () => {
    const result = validateCsvBuffer(csvBuffer(5), spec);
    expect(result.ok).toBe(true);
    expect(result.rows).toBe(5);
  });

  it('EUC-KR 인코딩도 헤더를 인식한다', () => {
    const result = validateCsvBuffer(csvBuffer(5, 'euc-kr'), spec);
    expect(result.ok).toBe(true);
  });

  it('필수 헤더가 없으면 거부한다 (HTML 오류 페이지 등)', () => {
    const html = Buffer.from('<!DOCTYPE html><html><body>403 Forbidden</body></html>', 'utf-8');
    const result = validateCsvBuffer(html, spec);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('헤더');
  });

  it('행 수가 하한 미만이면 거부한다 (절단 응답 fail-closed)', () => {
    const result = validateCsvBuffer(csvBuffer(2), spec);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('행');
  });
});

describe('ensureLatestLocaldataCsvs', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'localdata-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function mockFetchWith(buf: Buffer, status = 200) {
    return vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      arrayBuffer: () => Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)),
    });
  }

  it('신규 파일을 다운로드해 저장한다 (updated)', async () => {
    const spec = makeSpec(dir);
    const fresh = csvBuffer(5);
    const { results } = await ensureLatestLocaldataCsvs([spec], mockFetchWith(fresh) as unknown as typeof fetch);
    expect(results[0].status).toBe('updated');
    expect(fs.readFileSync(spec.targetPath)).toEqual(fresh);
  });

  it('내용이 같으면 unchanged 로 스킵한다', async () => {
    const spec = makeSpec(dir);
    const same = csvBuffer(5);
    fs.writeFileSync(spec.targetPath, same);
    const { results } = await ensureLatestLocaldataCsvs([spec], mockFetchWith(same) as unknown as typeof fetch);
    expect(results[0].status).toBe('unchanged');
  });

  it('내용이 다르면 교체하고 .bak 백업을 남긴다', async () => {
    const spec = makeSpec(dir);
    const old = csvBuffer(4);
    const fresh = csvBuffer(6);
    fs.writeFileSync(spec.targetPath, old);
    const { results } = await ensureLatestLocaldataCsvs([spec], mockFetchWith(fresh) as unknown as typeof fetch);
    expect(results[0].status).toBe('updated');
    expect(fs.readFileSync(spec.targetPath)).toEqual(fresh);
    expect(fs.readFileSync(spec.targetPath + '.bak')).toEqual(old);
  });

  it('검증 실패 시 기존 파일을 보존한다 (failed)', async () => {
    const spec = makeSpec(dir);
    const old = csvBuffer(4);
    fs.writeFileSync(spec.targetPath, old);
    const html = Buffer.from('<!DOCTYPE html><html>403</html>', 'utf-8');
    const { results } = await ensureLatestLocaldataCsvs([spec], mockFetchWith(html) as unknown as typeof fetch);
    expect(results[0].status).toBe('failed');
    expect(fs.readFileSync(spec.targetPath)).toEqual(old);
  });

  it('HTTP 오류 시 기존 파일을 보존한다 (failed)', async () => {
    const spec = makeSpec(dir);
    const old = csvBuffer(4);
    fs.writeFileSync(spec.targetPath, old);
    const { results } = await ensureLatestLocaldataCsvs([spec], mockFetchWith(Buffer.from(''), 403) as unknown as typeof fetch);
    expect(results[0].status).toBe('failed');
    expect(results[0].reason).toContain('403');
    expect(fs.readFileSync(spec.targetPath)).toEqual(old);
  });

  it('한 파일 실패가 다른 파일 처리를 막지 않는다', async () => {
    const specA = makeSpec(dir, { category: 'toilet', targetPath: path.join(dir, 'a.csv') });
    const specB = makeSpec(dir, { category: 'wifi', targetPath: path.join(dir, 'b.csv') });
    const fresh = csvBuffer(5);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(fresh.buffer.slice(fresh.byteOffset, fresh.byteOffset + fresh.byteLength)),
      });
    const { results } = await ensureLatestLocaldataCsvs([specA, specB], fetchMock as unknown as typeof fetch);
    expect(results.map((r) => r.status)).toEqual(['failed', 'updated']);
    expect(fs.readFileSync(specB.targetPath)).toEqual(fresh);
  });
});
