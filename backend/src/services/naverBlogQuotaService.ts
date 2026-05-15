/**
 * 인메모리 일일 quota 카운터. KST(UTC+9) 자정 기준 리셋.
 * 추후 Redis로 옮길 수 있도록 인터페이스 형태로 노출.
 */

export interface NaverBlogQuotaCounter {
  tryConsume(): boolean;
  used(): number;
}

interface Options {
  dailyLimit: number;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstDateKey(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function createNaverBlogQuotaCounter({ dailyLimit }: Options): NaverBlogQuotaCounter {
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
    tryConsume(): boolean {
      rollOverIfNeeded();
      if (usedCount >= dailyLimit) return false;
      usedCount += 1;
      return true;
    },
    used(): number {
      rollOverIfNeeded();
      return usedCount;
    },
  };
}

// Naver Search API 무료 일일 한도 25,000건. 다른 잠재 사용처 보호 위해 보수적으로 5,000건 사용.
export const naverBlogQuotaCounter = createNaverBlogQuotaCounter({ dailyLimit: 5000 });
