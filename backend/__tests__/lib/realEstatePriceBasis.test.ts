import { describe, it, expect } from 'vitest';
import {
  type BasisDeal,
  areaGroupKey,
  areaGroupLabel,
  areaGroupPyeong,
  buildAreaGroups,
  chooseDefaultAreaGroup,
  classifyDeals,
  classifyDealsDetailed,
  computePriceBasis,
  exclusivePyeong,
  median,
  monthsBefore,
} from '../../src/lib/realEstatePriceBasis.js';

const TODAY = '2026-10-23';

const mk = (
  id: number,
  date: string,
  amount: number,
  area = '84.97',
  floor: number | null = 10,
  direct = false,
): BasisDeal => ({ id, date, amount, area, floor, direct });

const oct: BasisDeal[] = (
  [
    [1, '2026-10-19', 91000, 20],
    [2, '2026-10-18', 88000, 5],
    [3, '2026-10-17', 94000, 8],
    [4, '2026-10-17', 95000, 9],
    [5, '2026-10-14', 53000, 12],
    [6, '2026-10-14', 97000, 20],
    [7, '2026-10-12', 100000, 17],
    [8, '2026-10-04', 91000, 8],
    [9, '2026-10-02', 103000, 15],
    [10, '2026-09-22', 92500, 10],
    [11, '2026-09-10', 90000, 7],
  ] as [number, string, number, number][]
).map(([id, date, amount, floor]) => mk(id, date, amount, '84.97', floor));

describe('realEstatePriceBasis', () => {
  it('flags the 53,000 deal as outlier and nothing else', () => {
    const flags = classifyDeals(oct);
    expect(flags.get(5)).toBe('outlier');
    for (const d of oct) {
      if (d.id !== 5) expect(flags.get(d.id)).toBe('normal');
    }
  });

  it('representative is median of latest 5 normal deals', () => {
    const flags = classifyDeals(oct);
    const basis = computePriceBasis(oct, flags, TODAY, 5);
    expect(basis.representative).toBe(94000);
    expect(basis.sampleCount).toBe(5);
    expect(basis.latest?.id).toBe(1);
    expect(basis.max12m).toBe(103000);
    expect(basis.excluded).toEqual([
      { id: 5, date: '2026-10-14', amount: 53000, floor: 12, reason: 'outlier', deviation: -0.43 },
    ]);
  });

  it('direct deal is excluded with reason direct', () => {
    const deals = [
      mk(20, '2026-10-21', 52000, '59.89', 3, true),
      mk(21, '2026-10-13', 85900, '59.89'),
      mk(22, '2026-10-02', 82000, '59.89'),
      mk(23, '2026-09-04', 76000, '59.89'),
      mk(24, '2026-08-22', 78000, '59.89'),
      mk(25, '2026-08-08', 70000, '59.89'),
    ];
    const basis = computePriceBasis(deals, classifyDeals(deals), TODAY, 5);
    expect(basis.representative).toBe(78000);
    expect(basis.excluded[0]).toMatchObject({ id: 20, reason: 'direct', deviation: null });
    expect(basis.latest?.amount).toBe(85900);
  });

  it('fewer than 3 normal deals gives no representative', () => {
    const deals = [mk(1, '2026-10-01', 90000), mk(2, '2026-09-01', 91000)];
    const basis = computePriceBasis(deals, classifyDeals(deals), TODAY, 5);
    expect(basis.representative).toBeNull();
    expect(basis.latest).not.toBeNull();
  });

  it('outlier needs 5 neighbors', () => {
    const deals = [
      mk(1, '2026-10-01', 90000),
      mk(2, '2026-09-20', 91000),
      mk(3, '2026-09-10', 92000),
      mk(4, '2026-09-01', 45000),
    ];
    const flags = classifyDeals(deals);
    for (const d of deals) expect(flags.get(d.id)).toBe('normal');
  });

  it('ties break by id', () => {
    const deals = [mk(7, '2026-10-10', 90000), mk(9, '2026-10-10', 91000)];
    const basis = computePriceBasis(deals, classifyDeals(deals), TODAY, 5);
    expect(basis.latest?.id).toBe(9);
  });

  it('yearAgo and changeRate', () => {
    const deals = [
      ...oct,
      mk(101, '2025-10-05', 70000),
      mk(102, '2025-10-12', 71600),
      mk(103, '2025-10-20', 72000),
    ];
    const basis = computePriceBasis(deals, classifyDeals(deals), TODAY, 5);
    expect(basis.yearAgo).toBe(71600);
    expect(basis.changeRate).toBe(0.3128);
  });

  it('area groups and default', () => {
    const sale = [
      mk(1, '2026-10-01', 90000, '84.96'),
      mk(2, '2026-09-01', 90000, '84.97'),
      mk(3, '2026-08-01', 90000, '84.98'),
      mk(4, '2026-07-01', 50000, '59.89'),
    ];
    const jeonse = [
      mk(5, '2026-10-01', 40000, '59.89'),
      mk(6, '2026-09-01', 40000, '59.89'),
      mk(7, '2026-08-01', 60000, '84.97'),
    ];
    const groups = buildAreaGroups(sale, jeonse, TODAY);
    expect(groups.map((g) => g.key)).toEqual(['60', '85']);
    expect(groups[1]).toMatchObject({ key: '85', label: '84', pyeong: 26, saleCount36m: 3, jeonseCount36m: 1 });
    expect(groups[0]).toMatchObject({ key: '60', label: '59', pyeong: 18, saleCount36m: 1, jeonseCount36m: 2 });
    expect(chooseDefaultAreaGroup(groups, sale, jeonse, 'sale')).toBe('85');
    expect(chooseDefaultAreaGroup(groups, sale, jeonse, 'jeonse')).toBe('60');
  });

  it('monthsBefore clamps month end', () => {
    expect(monthsBefore('2026-03-31', 1)).toBe('2026-02-28');
    expect(monthsBefore('2026-10-23', 12)).toBe('2025-10-23');
  });

  it('helpers: key, pyeong, median, label, group pyeong', () => {
    expect(areaGroupKey('84.97')).toBe('85');
    expect(exclusivePyeong(84.97)).toBe(26);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(areaGroupLabel(['84.97', '84.97', '85.2'])).toBe('84');
    expect(areaGroupLabel(['84.97', '85.2'])).toBe('84');
    expect(areaGroupPyeong(['84.97', '84.97', '85.2'])).toBe(26);
  });

  describe('near-linear neighbor selection', () => {
    // 이전(Task 2) 구현을 그대로 옮긴 기준 구현 — 결과 동일성 검증용.
    const DAY = 86_400_000;
    const utc = (date: string): number => {
      const [y, m, d] = date.split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    };
    const diff = (a: string, b: string): number => Math.abs(utc(a) - utc(b)) / DAY;
    const refMedian = (target: BasisDeal, group: BasisDeal[]): number | null => {
      const c = group
        .filter((d) => d.id !== target.id && !d.direct && diff(d.date, target.date) <= 183)
        .sort((a, b) => diff(a.date, target.date) - diff(b.date, target.date) || a.id - b.id)
        .slice(0, 10);
      return c.length < 5 ? null : median(c.map((d) => d.amount));
    };
    const refClassify = (deals: BasisDeal[]): Map<number, string> => {
      const flags = new Map<number, string>();
      for (const d of deals) {
        const group = deals.filter((x) => areaGroupKey(x.area) === areaGroupKey(d.area));
        if (d.direct) {
          flags.set(d.id, 'direct');
          continue;
        }
        const med = refMedian(d, group);
        flags.set(d.id, med !== null && Math.abs(d.amount / med - 1) >= 0.4 ? 'outlier' : 'normal');
      }
      return flags;
    };

    let seed = 12345;
    const rand = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const randomDeals = (n: number): BasisDeal[] => {
      const ids = Array.from({ length: n }, (_, i) => i + 1).sort(() => rand() - 0.5);
      return ids.map((id) => {
        const day = Math.floor(rand() * 500); // 같은 날짜·같은 거리 동률이 많이 생기도록 좁은 범위
        const date = new Date(Date.UTC(2025, 0, 1) + day * DAY).toISOString().slice(0, 10);
        const amount = rand() < 0.15 ? Math.round(30000 + rand() * 150000) : Math.round(85000 + rand() * 20000);
        const area = rand() < 0.7 ? '84.97' : '59.89';
        return mk(id, date, amount, area, 5, rand() < 0.2);
      });
    };

    it('matches the reference classification on random data with heavy ties', () => {
      for (const n of [3, 12, 40, 150, 400]) {
        const deals = randomDeals(n);
        const ref = refClassify(deals);
        const flags = classifyDeals(deals);
        for (const d of deals) expect(flags.get(d.id)).toBe(ref.get(d.id));
      }
    });

    it('exposes raw deviation for classified deals', () => {
      const { flags, deviations } = classifyDealsDetailed(oct);
      expect(flags.get(5)).toBe('outlier');
      // 53000 vs 이웃 10건 중간값 93250
      expect(deviations.get(5)).toBeCloseTo(53000 / 93250 - 1, 10);
      expect(deviations.has(1)).toBe(true);
    });

    it('computePriceBasis reuses supplied deviations', () => {
      const { flags, deviations } = classifyDealsDetailed(oct);
      const forced = new Map(deviations);
      forced.set(5, -0.5);
      const basis = computePriceBasis(oct, flags, TODAY, 5, forced);
      expect(basis.excluded[0]).toMatchObject({ id: 5, deviation: -0.5 });
    });

    it('classifies 5,000 deals in one group under 200 ms', () => {
      const deals: BasisDeal[] = [];
      for (let i = 0; i < 5000; i++) {
        const day = i % 1095;
        const date = new Date(Date.UTC(2023, 9, 1) + day * DAY).toISOString().slice(0, 10);
        deals.push(mk(i + 1, date, 80000 + ((i * 7919) % 30000), '84.97', 5, i % 13 === 0));
      }
      const start = performance.now();
      const flags = classifyDeals(deals);
      const elapsed = performance.now() - start;
      expect(flags.size).toBe(5000);
      expect(elapsed).toBeLessThan(200);
    });
  });
});
