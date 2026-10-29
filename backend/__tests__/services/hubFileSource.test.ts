import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseHubFileList,
  extractHubCsrf,
  findHubFile,
  openHubSession,
  downloadHubFile,
  DOWNLOAD_TIMEOUT_MS,
  type HubFileEntry,
} from '../../src/services/hubFileSource.js';

// 2026-10-29 대용량 제공 서비스 목록의 한 행 모양
const ROW = (se: string, cd: string, title: string, id: string) =>
  `<button type="button" onclick="javascript:fnLgcptPop('${se}','${cd}','${title}','국토교통부/녹색건축과')">설명</button>` +
  `<button type="button" class="button x-small" onclick="fnDownloadPop('${se}','${cd}','${id}')">전체 다운로드</button>`;
const CSRF = '<input type="hidden" name="_csrf" value="cae303bb-ca29" />';

const TITLE_0303: HubFileEntry = {
  taskSe: '03', taskCode: '0303', title: '표제부 (2026년 09월)', sourceMonth: '2026-09', fileId: 'OPN202610201221084580',
};

function htmlResponse(html: string, cookie = 'JSESSIONID=abc; Path=/'): Response {
  return new Response(html, { status: 200, headers: { 'set-cookie': cookie, 'content-type': 'text/html' } });
}

describe('parseHubFileList / findHubFile', () => {
  it('03 업무 행을 대상 월과 함께 읽는다', () => {
    const html = ROW('04', '0403', '표제부 (2026년 09월)', 'OPN1') + ROW('03', '0303', '표제부 (2026년 09월)', 'OPN202610201221084580');
    expect(findHubFile(parseHubFileList(html), '0303')).toEqual(TITLE_0303);
  });

  it('폐쇄말소(04)만 있으면 null', () => {
    expect(findHubFile(parseHubFileList(ROW('04', '0403', '표제부 (2026년 09월)', 'OPN1')), '0303')).toBeNull();
  });

  it('대상 월이 없는 제목은 건너뛴다', () => {
    expect(parseHubFileList(ROW('03', '0303', '표제부', 'OPN1'))).toEqual([]);
  });
});

describe('extractHubCsrf', () => {
  it('hidden input 에서 읽는다', () => {
    expect(extractHubCsrf('<input type="hidden" name="_csrf" value="ab-12" />')).toBe('ab-12');
    expect(extractHubCsrf('<html></html>')).toBeNull();
  });
});

describe('openHubSession', () => {
  it('03 의 세 파일이 모두 나올 때까지 다음 쪽을 읽는다', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(htmlResponse(CSRF + ROW('04', '0403', '표제부 (2026년 09월)', 'OPN1')))
      .mockResolvedValueOnce(htmlResponse(CSRF + ROW('03', '0306', '전유공용면적 (2026년 09월)', 'OPN6')))
      .mockResolvedValueOnce(htmlResponse(CSRF + ROW('03', '0303', '표제부 (2026년 09월)', 'OPN3') + ROW('03', '0302', '총괄표제부 (2026년 09월)', 'OPN2')));
    const session = await openHubSession(fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(String(fetchFn.mock.calls[1][0])).toContain('pageIndex=2');
    expect(fetchFn.mock.calls[1][1].headers.Cookie).toBe('JSESSIONID=abc');
    expect(session.csrf).toBe('cae303bb-ca29');
    expect(session.entries.map((e) => e.taskCode).sort()).toEqual(['0302', '0303', '0306', '0403']);
  });

  it('CSRF 가 없으면 실패', async () => {
    const fetchFn = vi.fn().mockResolvedValue(htmlResponse('<html></html>'));
    await expect(openHubSession(fetchFn as unknown as typeof fetch)).rejects.toThrow(/CSRF/);
  });
});

describe('downloadHubFile', () => {
  const session = { cookie: 'JSESSIONID=abc', csrf: 'tok', entries: [] };
  const okName = encodeURIComponent('국토교통부_건축물대장_표제부+(2026년+09월).zip');
  const closedName = encodeURIComponent('국토교통부_폐쇄말소대장_표제부+(2026년+09월).zip');

  it('목적 기록 뒤 파일을 디스크로 흘려 쓴다', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hub-'));
    const dest = join(dir, 'title.zip');
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('a|b\n', { status: 200, headers: { 'content-disposition': `attachment;filename=${okName}` } }));
    const result = await downloadHubFile(session, TITLE_0303, dest, fetchFn as unknown as typeof fetch);
    expect(result).toEqual({ bytes: 4 });
    expect(readFileSync(dest, 'utf8')).toBe('a|b\n');
    expect(String(fetchFn.mock.calls[0][0])).toContain('/portal/opn/lps/idx-srvc-hstry-insert.do');
    expect(String(fetchFn.mock.calls[0][1].body)).toContain('opnTaskCd=0303');
    expect(fetchFn.mock.calls[0][1].headers['X-CSRF-TOKEN']).toBe('tok');
    expect(String(fetchFn.mock.calls[1][0])).toContain('/cmm/fms/fileOpnDown.do');
    expect(String(fetchFn.mock.calls[1][1].body)).toContain('srvrFileNm=OPN202610201221084580');
  });

  it('파일 이름이 건축물대장이 아니면 실패', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hub-'));
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(new Response('x', { status: 200, headers: { 'content-disposition': `attachment;filename=${closedName}` } }));
    await expect(downloadHubFile(session, TITLE_0303, join(dir, 'x.zip'), fetchFn as unknown as typeof fetch))
      .rejects.toThrow(/건축물대장/);
  });
});

describe('DOWNLOAD_TIMEOUT_MS', () => {
  it('3GB 전유공용면적도 느린 회선에서 끝나도록 2시간', () => {
    expect(DOWNLOAD_TIMEOUT_MS).toBe(2 * 60 * 60_000);
  });
});
