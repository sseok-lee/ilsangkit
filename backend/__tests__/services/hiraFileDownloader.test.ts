import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';
import {
  scrapeLatestFile,
  buildDext5DownloadBody,
  downloadHiraZip,
  extractZipToDir,
  ensureLatestHiraFiles,
  pruneStaleXlsx,
} from '../../src/services/hiraFileDownloader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, 'fixtures/hira-portal.html'), 'utf-8');

describe('scrapeLatestFile', () => {
  it('가장 큰 fileSno(최신 분기)를 골라 fileSno·filePath·fileName을 추출한다', () => {
    const ref = scrapeLatestFile(html);
    expect(ref).not.toBeNull();
    expect(ref!.fileSno).toMatch(/^\d+$/);
    // 픽스처(2026-07-14 캡처)의 최신 분기: fileSno 326801, "전국 병의원 및 약국 현황 2026.6.zip"
    expect(ref!.fileSno).toBe('326801');
    expect(ref!.filePath).toMatch(/\/shared\/data\/uploadFiles\/file\/.+\.zip$/);
    expect(ref!.fileName).toContain('병의원');
    expect(ref!.fileName).toContain('2026.6');
  });

  it('링크가 없으면 null', () => {
    expect(scrapeLatestFile('<html><body>no downloads</body></html>')).toBeNull();
  });
});

describe('buildDext5DownloadBody', () => {
  it('customValue와 d00을 포함한 폼 바디를 만든다', () => {
    const body = buildDext5DownloadBody({
      fileSno: '326801',
      filePath: '/shared/data/uploadFiles/file/ABCD-1234.zip',
      fileName: '전국 병의원 및 약국 현황 2026.6.zip',
    });
    const params = new URLSearchParams(body);
    expect(params.get('customValue')).toBe('326801');
    const d00 = params.get('d00')!;
    expect(d00.length).toBeGreaterThan(0);

    // d00 디코드 시 서버 경로가 포함되어야 함.
    // 실제 DEXT5 프레이밍은 Task A2 Step 1 라이브 그라운드 트루스(dext5upload.js
    // util.makeEncryptParam 역추적 + 실서버 스모크로 검증)로 확정된 이중 base64 구조다:
    //   d00 = base64( "R" + base64(utf8(평문)) ).replace(/\+/g, '%2B')
    // 따라서 디코드는 역순: literal '%2B' -> '+' 복원 -> base64 디코드 -> 'R' 접두 제거 -> base64 디코드.
    const outer = Buffer.from(d00.replace(/%2B/g, '+'), 'base64').toString('utf-8');
    expect(outer.startsWith('R')).toBe(true);
    const plain = Buffer.from(outer.slice(1), 'base64').toString('utf-8');
    expect(plain).toContain('/shared/data/uploadFiles/file/ABCD-1234.zip');
    expect(plain).toContain('전국 병의원 및 약국 현황 2026.6.zip');
  });
});

describe('downloadHiraZip', () => {
  it('application/zip 응답을 Buffer로 반환한다', async () => {
    const fakeZip = Buffer.from('PKfakezipbody');
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/zip' }),
      arrayBuffer: () => Promise.resolve(fakeZip.buffer.slice(0, fakeZip.length)),
    });
    // @ts-expect-error test override
    global.fetch = mockFetch;
    const buf = await downloadHiraZip(
      { fileSno: '1', filePath: '/shared/data/uploadFiles/file/x.zip', fileName: 'x.zip' },
      'WMONID=abc; HIRAODSESSION=def',
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/dext5upload/handler/upload.dx'),
      expect.objectContaining({ method: 'POST' }),
    );
    // 헤더 회귀 가드: Cookie/User-Agent가 나중에 실수로 빠지면 이 단언이 잡아낸다.
    const [, requestInit] = mockFetch.mock.calls[0];
    expect(requestInit.headers).toMatchObject({
      Cookie: 'WMONID=abc; HIRAODSESSION=def',
      'User-Agent': expect.stringContaining('Mozilla/5.0'),
    });
  });

  it('content-type이 zip이 아니면 throw', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'text/html' }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
    });
    // @ts-expect-error test override
    global.fetch = mockFetch;
    await expect(
      downloadHiraZip({ fileSno: '1', filePath: '/x.zip', fileName: 'x.zip' }, 'c=1'),
    ).rejects.toThrow();
  });
});

describe('extractZipToDir', () => {
  it('UTF-8 파일명(실제 HIRA zip 시나리오)을 그대로 전개한다', () => {
    // Task A2 라이브 다운로드 실측: HIRA zip은 UTF-8 general-purpose flag로 저장되어
    // adm-zip의 기본 entryName이 이미 정확한 한글이다 — 디코딩 변환 없이 그대로 사용한다.
    const zip = new AdmZip();
    zip.addFile('7.의료장비정보.xlsx', Buffer.from('dummy'));
    const buf = zip.toBuffer();

    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'hira-utf8-'));
    const names = extractZipToDir(buf, dest);
    expect(names.some((n) => n.normalize('NFC').includes('의료장비'))).toBe(true);
    expect(fs.readdirSync(dest).some((n) => n.normalize('NFC').includes('의료장비'))).toBe(true);
  });
});

describe('pruneStaleXlsx', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hira-prune-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('keep 목록에 없는 이전 분기 xlsx/xls만 제거하고, 마커·비-xlsx는 건드리지 않는다', () => {
    const oldXlsx = '4.세부정보(2026.6.).xlsx';
    const newXlsx = '4.세부정보(2026.9.).xlsx';
    const marker = '.hira_filesno';
    const other = 'subway.csv';

    fs.writeFileSync(path.join(tmpDir, oldXlsx), 'old');
    fs.writeFileSync(path.join(tmpDir, newXlsx), 'new');
    fs.writeFileSync(path.join(tmpDir, marker), '326801');
    fs.writeFileSync(path.join(tmpDir, other), 'not-xlsx');

    const removed = pruneStaleXlsx(tmpDir, [newXlsx]);

    expect(removed).toContain(oldXlsx);
    expect(fs.existsSync(path.join(tmpDir, oldXlsx))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, newXlsx))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, marker))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, other))).toBe(true);
  });

  it('keep이 현재 존재하는 모든 xlsx를 포함하면 아무것도 제거하지 않는다', () => {
    const a = '4.세부정보(2026.9.).xlsx';
    const b = '7.의료장비정보(2026.9.).xlsx';
    fs.writeFileSync(path.join(tmpDir, a), 'a');
    fs.writeFileSync(path.join(tmpDir, b), 'b');

    const removed = pruneStaleXlsx(tmpDir, [a, b]);

    expect(removed).toEqual([]);
    expect(fs.existsSync(path.join(tmpDir, a))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, b))).toBe(true);
  });
});

describe('ensureLatestHiraFiles freshness gate', () => {
  // 실 backend/prisma/data/extra_hospital_latest/.hira_filesno는 절대 건드리지 않는다 —
  // ensureLatestHiraFiles가 HIRA_DATA_DIR 환경변수(process.env, 호출 시점에 읽음)를
  // 우선 사용하도록 되어 있으므로, 테스트 전용 임시 디렉터리로 완전히 격리한다.
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hira-marker-test-'));
    process.env.HIRA_DATA_DIR = tmpDir;
  });

  afterEach(() => {
    delete process.env.HIRA_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('마커 fileSno와 최신이 같으면 다운로드 없이 updated:false', async () => {
    // 픽스처(2026-07-14 캡처)의 최신 fileSno=326801을 임시 디렉터리 마커에 기록해 게이트를 태운다.
    fs.writeFileSync(path.join(tmpDir, '.hira_filesno'), '326801');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'set-cookie': 'WMONID=x' }),
      text: () => Promise.resolve(html),
    });
    // @ts-expect-error test override
    global.fetch = mockFetch;

    const result = await ensureLatestHiraFiles();
    expect(result.updated).toBe(false);
    expect(result.fileSno).toBe('326801');
    // 포털 GET 1회만 호출되고, 다운로드(POST handler)는 호출되지 않아야 함
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/dext5upload/handler/upload.dx'),
      expect.anything(),
    );
  });
});
