import { describe, it, expect } from 'vitest';
import {
  type BasisDeal,
  areaGroupKey,
  areaGroupLabel,
  areaGroupPyeong,
  buildAreaGroups,
  chooseDefaultAreaGroup,
  classifyDeals,
  computePriceBasis,
  exclusivePyeong,
  labelAreaGroups,
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
  it('classifies direct deals as direct and every other deal as normal', () => {
    const deals = [...oct, mk(50, '2026-10-21', 52000, '84.97', 3, true)];
    const flags = classifyDeals(deals);
    expect(flags.get(50)).toBe('direct');
    for (const d of oct) expect(flags.get(d.id)).toBe('normal');
  });

  it('representative is median of latest 5 deals of any kind', () => {
    const basis = computePriceBasis(oct, TODAY, 5);
    // 최신 5건: 91000, 88000, 94000(id 3), 95000(id 4), 97000(id 6, 같은 날 id 큰 쪽 먼저)
    expect(basis.representative).toBe(94000);
    expect(basis.sampleCount).toBe(5);
    expect(basis.latestAny?.id).toBe(1);
    expect(basis.max12m).toBe(103000);
    expect(basis).not.toHaveProperty('excluded');
    expect(basis).not.toHaveProperty('latest');
  });

  it('a deal 50% below its neighbours is included in the representative', () => {
    const deals = [
      mk(1, '2026-10-19', 90000),
      mk(2, '2026-10-18', 45000),
      mk(3, '2026-10-17', 92000),
      mk(4, '2026-10-16', 91000),
      mk(5, '2026-10-15', 93000),
      ...Array.from({ length: 8 }, (_, i) => mk(10 + i, `2026-09-${String(10 + i).padStart(2, '0')}`, 90000 + i * 100)),
    ];
    const basis = computePriceBasis(deals, TODAY, 5);
    // 45000 포함 최신 5건: 45000, 90000, 91000, 92000, 93000 → 중간값 91000
    expect(basis.representative).toBe(91000);
    expect(basis.sampleCount).toBe(5);
  });

  it('direct deal among the latest 5 is included in the representative', () => {
    const deals = [
      mk(20, '2026-10-21', 52000, '59.89', 3, true),
      mk(21, '2026-10-13', 85900, '59.89'),
      mk(22, '2026-10-02', 82000, '59.89'),
      mk(23, '2026-09-04', 76000, '59.89'),
      mk(24, '2026-08-22', 78000, '59.89'),
      mk(25, '2026-08-08', 70000, '59.89'),
    ];
    const basis = computePriceBasis(deals, TODAY, 5);
    // 중개 4건 + 직거래 1건: 52000, 85900, 82000, 76000, 78000 → 78000
    expect(basis.representative).toBe(78000);
    expect(basis.sampleCount).toBe(5);
    expect(basis.latestAny).toMatchObject({ id: 20, amount: 52000, direct: true });
    expect(basis.max12m).toBe(85900);
  });

  it('fewer than 3 deals gives no representative', () => {
    const deals = [mk(1, '2026-10-01', 90000), mk(2, '2026-09-01', 91000, '84.97', 10, true)];
    const basis = computePriceBasis(deals, TODAY, 5);
    expect(basis.representative).toBeNull();
    expect(basis.sampleCount).toBe(0);
    expect(basis.latestAny).not.toBeNull();
  });

  it('three deals including direct ones give a representative', () => {
    const deals = [
      mk(1, '2026-10-01', 90000, '84.97', 10, true),
      mk(2, '2026-09-01', 91000, '84.97', 10, true),
      mk(3, '2026-08-01', 30000),
    ];
    const basis = computePriceBasis(deals, TODAY, 5);
    expect(basis.representative).toBe(90000);
    expect(basis.sampleCount).toBe(3);
  });

  it('ties break by id', () => {
    const deals = [mk(7, '2026-10-10', 90000), mk(9, '2026-10-10', 91000)];
    const basis = computePriceBasis(deals, TODAY, 5);
    expect(basis.latestAny?.id).toBe(9);
  });

  it('yearAgo and changeRate', () => {
    const deals = [
      ...oct,
      mk(101, '2025-10-05', 70000),
      mk(102, '2025-10-12', 71600),
      mk(103, '2025-10-20', 72000),
    ];
    const basis = computePriceBasis(deals, TODAY, 5);
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
    expect(chooseDefaultAreaGroup(groups, sale, jeonse, 'sale', TODAY)).toBe('85');
    expect(chooseDefaultAreaGroup(groups, sale, jeonse, 'jeonse', TODAY)).toBe('60');
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

  describe('latestAny (직거래 포함 최근 거래)', () => {
    it('all-direct group exposes latestAny as direct', () => {
      const deals = [
        mk(1, '2026-05-01', 30000, '59.89', 2, true),
        mk(2, '2025-01-10', 28000, '59.89', 3, true),
      ];
      const basis = computePriceBasis(deals, TODAY, 5);
      expect(basis.representative).toBeNull();
      expect(basis.latestAny).toEqual({ id: 1, date: '2026-05-01', amount: 30000, floor: 2, direct: true });
    });

    it('direct deals older than 12 months still give latestAny', () => {
      const deals = [mk(3, '2024-02-01', 25000, '59.89', 1, true)];
      const basis = computePriceBasis(deals, TODAY, 5);
      expect(basis.representative).toBeNull();
      expect(basis.latestAny).toMatchObject({ id: 3, direct: true });
    });

    it('latestAny is the newest deal of any flag', () => {
      const basis = computePriceBasis(oct, TODAY, 5);
      expect(basis.latestAny).toEqual({ id: 1, date: '2026-10-19', amount: 91000, floor: 20, direct: false });
      const withDirect = [...oct, mk(50, '2026-10-21', 52000, '84.97', 3, true)];
      expect(computePriceBasis(withDirect, TODAY, 5).latestAny)
        .toMatchObject({ id: 50, direct: true });
    });

    it('empty group has null latestAny', () => {
      expect(computePriceBasis([], TODAY, 5).latestAny).toBeNull();
    });
  });

  describe('면적 그룹 라벨 충돌', () => {
    it('labels colliding groups with one decimal of the modal area', () => {
      const labels = labelAreaGroups(new Map([
        ['84', ['84.43', '84.43', '84.1']],
        ['85', ['84.97', '84.97', '85.2']],
        ['60', ['59.89']],
      ]));
      expect(labels.get('84')).toBe('84.4');
      expect(labels.get('85')).toBe('84.9');
      expect(labels.get('60')).toBe('59');
    });

    it('floors without float drift (84.3 stays 84.3)', () => {
      const labels = labelAreaGroups(new Map([
        ['84', ['84.30']],
        ['85', ['84.50']],
      ]));
      expect(labels.get('84')).toBe('84.3');
      expect(labels.get('85')).toBe('84.5');
    });

    it('buildAreaGroups uses disambiguated labels', () => {
      const sale = [mk(1, '2026-10-01', 90000, '84.43'), mk(2, '2026-09-01', 91000, '84.97')];
      const groups = buildAreaGroups(sale, [], TODAY);
      expect(groups.map((g) => [g.key, g.label])).toEqual([['84', '84.4'], ['85', '84.9']]);
    });
  });

  describe('기본 면적은 직거래 포함 전체 거래 수 기준', () => {
    it('counts direct deals too', () => {
      const sale = [
        mk(1, '2026-10-01', 30000, '59.89', 1, true),
        mk(2, '2026-09-01', 30000, '59.89', 1, true),
        mk(3, '2026-08-01', 30000, '59.89', 1, true),
        mk(4, '2026-07-01', 90000, '84.97'),
        mk(5, '2026-06-01', 91000, '84.97'),
      ];
      const groups = buildAreaGroups(sale, [], TODAY);
      expect(groups.find((g) => g.key === '60')?.saleCount36m).toBe(3);
      expect(chooseDefaultAreaGroup(groups, sale, [], 'sale', TODAY)).toBe('60');
    });

    it('tie-break uses the latest deal date including direct deals', () => {
      const sale = [
        mk(1, '2026-10-20', 30000, '59.89', 1, true),
        mk(2, '2025-01-01', 50000, '59.89'),
        mk(3, '2026-03-01', 90000, '84.97'),
        mk(4, '2026-04-01', 91000, '84.97'),
      ];
      const groups = buildAreaGroups(sale, [], TODAY);
      expect(chooseDefaultAreaGroup(groups, sale, [], 'sale', TODAY)).toBe('60');
    });

    it('equal count and date picks the smaller key', () => {
      const sale = [mk(1, '2026-10-01', 30000, '59.89'), mk(2, '2026-10-01', 90000, '84.97')];
      const groups = buildAreaGroups(sale, [], TODAY);
      expect(chooseDefaultAreaGroup(groups, sale, [], 'sale', TODAY)).toBe('60');
    });

    it('falls back to the other side, then to the smallest key', () => {
      const sale = [mk(1, '2020-10-01', 30000, '59.89', 1, true)];
      const jeonse = [mk(2, '2026-09-01', 40000, '84.97')];
      const groups = buildAreaGroups(sale, jeonse, TODAY);
      expect(chooseDefaultAreaGroup(groups, sale, jeonse, 'sale', TODAY)).toBe('85');
      const old = [mk(3, '2020-10-01', 30000, '84.97'), mk(4, '2020-09-01', 30000, '59.89')];
      const g2 = buildAreaGroups(old, [], TODAY);
      expect(chooseDefaultAreaGroup(g2, old, [], 'sale', TODAY)).toBe('60');
    });
  });
});
