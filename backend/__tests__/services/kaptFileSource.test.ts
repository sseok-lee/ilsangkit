import { describe, it, expect, vi } from 'vitest';
import {
  extractCsrfToken,
  parseBoardListHtml,
  findLatestPost,
  openKaptSession,
  fetchLatestKaptPost,
  downloadKaptFile,
} from '../../src/services/kaptFileSource.js';

// 2026-10-28 실제 boardListAjax.do 응답에서 두 건만 잘라낸 모양
const LIST_HTML = `
<ul class="boardList">
    <li>
      <div class="boardHwrap">
        <div class="num">206</div>
        <a href="#" class="headLine" onclick="javascript:goCheck(136041, 0);">
          K-apt 관리비공개의무단지 기본정보(2026.10.26.)
        </a>
      </div>
      <p class="info">
        <span>관리자</span>
        <span><a href="javascript:fileDown('136041','03','1');"><img src="/images/icon/icon_file.gif" alt="파일" /></a></span>
      </p>
      <span class="boardDate">2026-10-26</span>
    </li>
    <li>
      <div class="boardHwrap">
        <a href="#" class="headLine" onclick="javascript:goCheck(136011, 0);">
          K-apt 관리비공개의무단지 기본정보(2026.10.23.)
        </a>
      </div>
      <p class="info"><span><a href="javascript:fileDown('136011','03','1');">파일</a></span></p>
      <span class="boardDate">2026-10-23</span>
    </li>
</ul>`;

const PAGE_HTML = `<head><meta id="_csrf" name="_csrf" content="0f2b6c1e-aaaa-bbbb-cccc-123456789abc" /></head>`;

function res(body: BodyInit, init: ResponseInit & { cookies?: string[] } = {}): Response {
  const headers = new Headers(init.headers);
  for (const c of init.cookies ?? []) headers.append('set-cookie', c);
  return new Response(body, { status: init.status ?? 200, headers });
}

describe('extractCsrfToken', () => {
  it('meta _csrf content 를 꺼낸다', () => {
    expect(extractCsrfToken(PAGE_HTML)).toBe('0f2b6c1e-aaaa-bbbb-cccc-123456789abc');
  });
  it('없으면 null', () => {
    expect(extractCsrfToken('<html></html>')).toBeNull();
  });
});

describe('parseBoardListHtml / findLatestPost', () => {
  it('게시글 번호·제목·기준일을 뽑는다', () => {
    const posts = parseBoardListHtml(LIST_HTML);
    expect(posts).toEqual([
      { postSeq: 136041, title: 'K-apt 관리비공개의무단지 기본정보(2026.10.26.)', fileDate: '2026-10-26' },
      { postSeq: 136011, title: 'K-apt 관리비공개의무단지 기본정보(2026.10.23.)', fileDate: '2026-10-23' },
    ]);
  });

  it('데이터셋 제목에 맞는 가장 최근 기준일 글을 고른다', () => {
    const posts = parseBoardListHtml(LIST_HTML);
    expect(findLatestPost(posts, 'basic')?.postSeq).toBe(136041);
    expect(findLatestPost(posts, 'parcel')).toBeNull();
  });

  it('필지고유번호 글은 제목이 "필지고유번호 정보(…)" 다', () => {
    const posts = [{ postSeq: 5240, title: 'K-apt 관리비공개의무단지 필지고유번호 정보(2026.10.26.)', fileDate: '2026-10-26' }];
    expect(findLatestPost(posts, 'parcel')?.postSeq).toBe(5240);
  });

  it('연도별 관리비처럼 날짜가 아닌 제목은 고르지 않는다', () => {
    const posts = [
      { postSeq: 1, title: 'K-apt 관리비공개의무단지 면적정보(2026년)', fileDate: null },
      { postSeq: 2, title: 'K-apt 관리비공개의무단지 면적정보(2026.10.26.)', fileDate: '2026-10-26' },
    ];
    expect(findLatestPost(posts, 'area')?.postSeq).toBe(2);
  });
});

describe('openKaptSession', () => {
  it('목록 페이지에서 세션 쿠키와 CSRF 토큰을 받는다', async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(PAGE_HTML, { cookies: ['JSESSIONID=abc; Path=/; HttpOnly', 'WMONID=x1; Path=/'] }));
    const session = await openKaptSession(fetchFn);
    expect(session).toEqual({ cookie: 'JSESSIONID=abc; WMONID=x1', csrf: '0f2b6c1e-aaaa-bbbb-cccc-123456789abc' });
    expect(fetchFn.mock.calls[0][0]).toBe('https://www.k-apt.go.kr/web/board/webReference/boardList.do');
  });

  it('토큰이 없으면 예외', async () => {
    const fetchFn = vi.fn().mockResolvedValue(res('<html></html>'));
    await expect(openKaptSession(fetchFn)).rejects.toThrow(/CSRF/);
  });
});

describe('fetchLatestKaptPost', () => {
  it('탭 코드와 토큰을 실어 목록을 POST 로 받는다', async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(LIST_HTML));
    const post = await fetchLatestKaptPost({ cookie: 'JSESSIONID=abc', csrf: 't' }, 'basic', fetchFn);
    expect(post?.postSeq).toBe(136041);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://www.k-apt.go.kr/web/board/webReference/boardListAjax.do');
    expect(init.method).toBe('POST');
    expect(String(init.body)).toContain('scode=01');
    expect(String(init.body)).toContain('_csrf=t');
    expect(init.headers.Cookie).toBe('JSESSIONID=abc');
  });
});

describe('downloadKaptFile', () => {
  const XLSX = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]);

  it('xlsx 와 파일명을 돌려준다', async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(XLSX, {
      headers: { 'content-disposition': 'attachment; filename="20261026_%EB%8B%A8%EC%A7%80_%EA%B8%B0%EB%B3%B8%EC%A0%95%EB%B3%B4.xlsx";' },
    }));
    const file = await downloadKaptFile({ cookie: 'c', csrf: 't' }, 136041, fetchFn);
    expect(file.fileName).toBe('20261026_단지_기본정보.xlsx');
    expect(file.buffer.equals(XLSX)).toBe(true);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('https://www.k-apt.go.kr/board/getFileDownload.do?seq=136041&boardType=03');
    expect(String(init.body)).toBe('_csrf=t&fileNum=1');
  });

  it('HTML 오류 페이지(정상적인 접근이 아닙니다)는 예외', async () => {
    const fetchFn = vi.fn().mockResolvedValue(res("<script>alert('정상적인 접근이 아닙니다.')</script>"));
    await expect(downloadKaptFile({ cookie: 'c', csrf: 't' }, 1, fetchFn)).rejects.toThrow(/xlsx/);
  });
});
