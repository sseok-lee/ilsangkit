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
  it('sessionId: 32자 hex 생성·재사용', () => {
    const s = useSearchSuggest();
    const id1 = s.getSessionId();
    expect(id1).toMatch(/^[0-9a-f]{32}$/);
    expect(useSearchSuggest().getSessionId()).toBe(id1);
  });
});
