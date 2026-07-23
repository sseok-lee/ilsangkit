import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSearchSuggest } from '~/composables/useSearchSuggest';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('$fetch', vi.fn(async () => ({ success: true, data: { items: [{ type: 'category', label: '화장실', category: 'toilet' }] } })));
})

describe('useSearchSuggest 최근검색', () => {
  it('addRecent: 최신순, 중복 제거, 최대 8개', () => {
    const s = useSearchSuggest();
    for (let i = 0; i < 10; i++) s.addRecent(`kw${i}`);
    s.addRecent('kw9'); // 중복
    expect(s.recent.value.length).toBe(8);
    expect(s.recent.value[0]).toBe('kw9'); // 최신
  });
  it('removeRecent / clearRecent', () => {
    const s = useSearchSuggest();
    s.addRecent('a'); s.addRecent('b');
    s.removeRecent('a');
    expect(s.recent.value).toEqual(['b']);
    s.clearRecent();
    expect(s.recent.value).toEqual([]);
  });
  it('loadRecent: 저장된 빈 문자열·공백·비문자열·중복 항목을 걸러 로드한다', () => {
    // 과거 데이터에 빈 문자열이 섞여 있어도 "최근 검색"에 유령 행이 뜨지 않아야 한다.
    localStorage.setItem(
      'ilsangkit:recentSearches',
      JSON.stringify(['', '  ', '화장실', '화장실', null, 42, ' 약국 ']),
    );
    const s = useSearchSuggest();
    expect(s.recent.value).toEqual(['화장실', '약국']);
  });
  it('sessionId: 32자 hex 생성·재사용', () => {
    const s = useSearchSuggest();
    const id1 = s.getSessionId();
    expect(id1).toMatch(/^[0-9a-f]{32}$/);
    expect(useSearchSuggest().getSessionId()).toBe(id1);
  });
});
