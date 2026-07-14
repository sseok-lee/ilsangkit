import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  scrapeLatestFile,
  buildDext5DownloadBody,
  downloadHiraZip,
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
