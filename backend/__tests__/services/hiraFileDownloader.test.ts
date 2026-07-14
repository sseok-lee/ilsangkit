import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scrapeLatestFile } from '../../src/services/hiraFileDownloader.js';

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
