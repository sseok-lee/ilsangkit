/**
 * 인메모리 일일 quota 카운터. KST(UTC+9) 자정 기준 리셋.
 * 추후 Redis로 옮길 수 있도록 인터페이스 형태로 노출.
 */

export interface YoutubeQuotaCounter {
  tryConsume(): boolean;
  used(): number;
}

interface Options {
  dailyLimit: number;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstDateKey(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return kst.toISOString().slice(0, 10);
}

export function createYoutubeQuotaCounter({ dailyLimit }: Options): YoutubeQuotaCounter {
  let currentKey = kstDateKey(new Date());
  let usedCount = 0;

  function rollOverIfNeeded(): void {
    const key = kstDateKey(new Date());
    if (key !== currentKey) {
      currentKey = key;
      usedCount = 0;
    }
  }

  return {
    tryConsume() {
      rollOverIfNeeded();
      if (usedCount >= dailyLimit) return false;
      usedCount += 1;
      return true;
    },
    used() {
      rollOverIfNeeded();
      return usedCount;
    },
  };
}

// 모듈 싱글톤. YouTube Data API search.list = 100 units, 일일 무료 10,000 units → 90회로 제한 (여유 10회).
export const youtubeQuotaCounter = createYoutubeQuotaCounter({ dailyLimit: 90 });
