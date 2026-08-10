import { describe, it, expect } from 'vitest';
import {
  extractLocs,
  selectFacilityChunks,
  filterDetailUrls,
  planSubmission,
} from '../../src/scripts/submitIndexNowBackfill.js';

const SITE = 'https://ilsangkit.co.kr';

describe('extractLocs', () => {
  it('sitemap XML에서 loc 목록을 추출한다', () => {
    const xml = `<?xml version="1.0"?><urlset>
      <url><loc>${SITE}/school/school-1</loc></url>
      <url><loc> ${SITE}/school/school-2 </loc></url>
    </urlset>`;
    expect(extractLocs(xml)).toEqual([`${SITE}/school/school-1`, `${SITE}/school/school-2`]);
  });

  it('&amp; 엔티티를 디코드한다', () => {
    const xml = `<url><loc>${SITE}/a?b=1&amp;c=2</loc></url>`;
    expect(extractLocs(xml)).toEqual([`${SITE}/a?b=1&c=2`]);
  });

  it('loc 이 없으면 빈 배열', () => {
    expect(extractLocs('<urlset></urlset>')).toEqual([]);
  });
});

describe('selectFacilityChunks', () => {
  const index = [
    `${SITE}/sitemap/static.xml`,
    `${SITE}/sitemap/real-estate-1.xml`,
    `${SITE}/sitemap/hospital-1.xml`,
    `${SITE}/sitemap/hospital-2.xml`,
    `${SITE}/sitemap/hospital-10.xml`,
    `${SITE}/sitemap/school-1.xml`,
    `${SITE}/sitemap/market.xml`,
    `${SITE}/sitemap/trash.xml`,
    `${SITE}/sitemap/subway.xml`,
    `${SITE}/sitemap/land.xml`,
  ];

  it('요청한 시설 카테고리의 청크만 고른다 (단일/번호 형식 모두)', () => {
    const chunks = selectFacilityChunks(index, ['hospital', 'market']);
    expect(chunks.map((c) => c.name)).toEqual([
      'hospital-1',
      'hospital-2',
      'hospital-10',
      'market',
    ]);
    expect(chunks[0].url).toBe(`${SITE}/sitemap/hospital-1.xml`);
    expect(chunks[0].category).toBe('hospital');
  });

  it('카테고리 인자 순서를 유지하고 청크 번호는 숫자 정렬한다', () => {
    const chunks = selectFacilityChunks(index, ['market', 'hospital']);
    expect(chunks.map((c) => c.name)).toEqual([
      'market',
      'hospital-1',
      'hospital-2',
      'hospital-10',
    ]);
  });

  it('trash/subway/real-estate/static 은 카테고리 목록에 없으면 제외된다', () => {
    const chunks = selectFacilityChunks(index, ['hospital']);
    const names = chunks.map((c) => c.name);
    expect(names).not.toContain('trash');
    expect(names).not.toContain('subway');
    expect(names).not.toContain('static');
  });

  it('접두어가 겹치는 다른 카테고리 청크를 잘못 매칭하지 않는다', () => {
    const idx = [`${SITE}/sitemap/park-1.xml`, `${SITE}/sitemap/parking-1.xml`];
    const chunks = selectFacilityChunks(idx, ['park']);
    expect(chunks.map((c) => c.name)).toEqual(['park-1']);
  });
});

describe('filterDetailUrls', () => {
  it('해당 카테고리의 상세 URL만 남긴다 (허브·타 호스트·딴 카테고리 제외)', () => {
    const urls = [
      `${SITE}/school/school-B000012076`,
      `${SITE}/school`,
      `${SITE}/school/`,
      `${SITE}/hospital/hospital-abc`,
      'https://evil.example.com/school/school-x',
      `${SITE}/school/a/b`,
    ];
    expect(filterDetailUrls(urls, 'school')).toEqual([`${SITE}/school/school-B000012076`]);
  });
});

describe('planSubmission', () => {
  const chunks = [
    { name: 'school-1', urls: ['u1', 'u2', 'u3'] },
    { name: 'school-2', urls: ['u4', 'u5'] },
  ];

  it('커서 이후부터 limit 만큼 청크 경계를 넘어 선택한다', () => {
    const { picks, nextCursors } = planSubmission(chunks, { 'school-1': 1 }, 3);
    expect(picks).toEqual([
      { name: 'school-1', urls: ['u2', 'u3'] },
      { name: 'school-2', urls: ['u4'] },
    ]);
    expect(nextCursors).toEqual({ 'school-1': 3, 'school-2': 1 });
  });

  it('커서가 없으면 0부터 시작한다', () => {
    const { picks } = planSubmission(chunks, {}, 2);
    expect(picks).toEqual([{ name: 'school-1', urls: ['u1', 'u2'] }]);
  });

  it('전부 제출된 청크는 건너뛴다', () => {
    const { picks, nextCursors } = planSubmission(chunks, { 'school-1': 3 }, 10);
    expect(picks).toEqual([{ name: 'school-2', urls: ['u4', 'u5'] }]);
    expect(nextCursors).toEqual({ 'school-1': 3, 'school-2': 2 });
  });

  it('남은 게 없으면 빈 계획을 돌려준다', () => {
    const { picks, nextCursors } = planSubmission(chunks, { 'school-1': 3, 'school-2': 2 }, 10);
    expect(picks).toEqual([]);
    expect(nextCursors).toEqual({ 'school-1': 3, 'school-2': 2 });
  });

  it('limit 0 이면 아무것도 선택하지 않는다', () => {
    const { picks } = planSubmission(chunks, {}, 0);
    expect(picks).toEqual([]);
  });
});
