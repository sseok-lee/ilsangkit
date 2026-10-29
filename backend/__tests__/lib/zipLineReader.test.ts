import { describe, it, expect } from 'vitest';
import AdmZip from 'adm-zip';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readZipLines } from '../../src/lib/zipLineReader.js';

function makeZip(text: string): string {
  const zip = new AdmZip();
  zip.addFile('mart_djy_02.txt', Buffer.from(text, 'utf8'));
  const path = join(mkdtempSync(join(tmpdir(), 'ziplines-')), 'test.zip');
  zip.writeZip(path);
  return path;
}

async function collect(path: string): Promise<string[]> {
  const lines: string[] = [];
  for await (const line of readZipLines(path)) lines.push(line);
  return lines;
}

describe('readZipLines', () => {
  it('CRLF·빈 줄·끝줄 개행 없음을 다룬다', async () => {
    expect(await collect(makeZip('a|1\r\nb|2\n\nc|3'))).toEqual(['a|1', 'b|2', 'c|3']);
  });

  it('한글 UTF-8 을 그대로 읽는다', async () => {
    expect(await collect(makeZip('대원빌라3단지|연립주택\n'))).toEqual(['대원빌라3단지|연립주택']);
  });

  it('10만 줄도 끝까지 읽는다', async () => {
    const text = Array.from({ length: 100_000 }, (_, i) => `${i}|행`).join('\n');
    const lines = await collect(makeZip(text));
    expect(lines).toHaveLength(100_000);
    expect(lines.at(-1)).toBe('99999|행');
  });

  it('파일 엔트리가 없으면 실패', async () => {
    const zip = new AdmZip();
    const path = join(mkdtempSync(join(tmpdir(), 'ziplines-')), 'empty.zip');
    zip.writeZip(path);
    await expect(collect(path)).rejects.toThrow(/파일이 없다/);
  });
});
