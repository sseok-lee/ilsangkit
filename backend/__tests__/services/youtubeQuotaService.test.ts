import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createYoutubeQuotaCounter } from '../../src/services/youtubeQuotaService.js';

describe('youtubeQuotaService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T09:00:00+09:00'));
  });

  it('첫 호출은 허용되고 used가 1 증가한다', () => {
    const counter = createYoutubeQuotaCounter({ dailyLimit: 90 });
    expect(counter.tryConsume()).toBe(true);
    expect(counter.used()).toBe(1);
  });

  it('한도에 도달하면 false를 반환한다', () => {
    const counter = createYoutubeQuotaCounter({ dailyLimit: 2 });
    expect(counter.tryConsume()).toBe(true);
    expect(counter.tryConsume()).toBe(true);
    expect(counter.tryConsume()).toBe(false);
    expect(counter.used()).toBe(2);
  });

  it('KST 자정이 지나면 카운터가 리셋된다', () => {
    const counter = createYoutubeQuotaCounter({ dailyLimit: 1 });
    expect(counter.tryConsume()).toBe(true);
    expect(counter.tryConsume()).toBe(false);

    vi.setSystemTime(new Date('2026-05-16T00:00:01+09:00'));
    expect(counter.tryConsume()).toBe(true);
    expect(counter.used()).toBe(1);
  });
});
