import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import { resolveGranularity, MapQuerySchema } from '../../src/schemas/realEstateMap.js';

describe('resolveGranularity', () => {
  it('level >= 11 은 city', () => {
    expect(resolveGranularity(11)).toBe('city');
    expect(resolveGranularity(14)).toBe('city');
  });

  it('level 9~10 은 district', () => {
    expect(resolveGranularity(9)).toBe('district');
    expect(resolveGranularity(10)).toBe('district');
  });

  it('level 7~8 은 dong', () => {
    expect(resolveGranularity(7)).toBe('dong');
    expect(resolveGranularity(8)).toBe('dong');
  });

  it('level <= 6 은 building', () => {
    expect(resolveGranularity(6)).toBe('building');
    expect(resolveGranularity(1)).toBe('building');
  });

  it('히스테리시스: district 에서 level 11 로 올라가도 한 단계는 버틴다', () => {
    // 경계에서 진동하면 좌측/마커가 깜빡인다. 이미 district 면 12 이상에서만 city 로 간다.
    expect(resolveGranularity(11, 'district')).toBe('district');
    expect(resolveGranularity(12, 'district')).toBe('city');
  });

  it('히스테리시스: city 에서 level 10 으로 내려가도 한 단계는 버틴다', () => {
    expect(resolveGranularity(10, 'city')).toBe('city');
    expect(resolveGranularity(9, 'city')).toBe('district');
  });
});

describe('resolveGranularity 4계층', () => {
  it('prev 없이 레벨만으로 4단위를 가른다', () => {
    expect(resolveGranularity(14)).toBe('city');
    expect(resolveGranularity(11)).toBe('city');
    expect(resolveGranularity(10)).toBe('district');
    expect(resolveGranularity(9)).toBe('district');
    expect(resolveGranularity(8)).toBe('dong');
    expect(resolveGranularity(7)).toBe('dong');
    expect(resolveGranularity(6)).toBe('building');
    expect(resolveGranularity(1)).toBe('building');
  });

  // 설계문서 5.1.1 전이표. 각 단위가 양방향 모두 정확히 2칸을 차지하고
  // 건너뛰는 단위가 없어야 한다 — 구·군 밴드가 9~10 두 칸뿐이라 특히 중요하다.
  it('한 칸씩 확대할 때 city→district→dong→building 을 순서대로 거친다', () => {
    const seen: any[] = [];
    let prev: any = 'city';
    for (const level of [12, 11, 10, 9, 8, 7, 6, 5]) {
      prev = resolveGranularity(level, prev);
      seen.push(prev);
    }
    expect(seen).toEqual([
      'city', 'city', 'city', 'district', 'district', 'dong', 'dong', 'building',
    ]);
  });

  it('한 칸씩 축소할 때 building→dong→district→city 를 순서대로 거친다', () => {
    const seen: any[] = [];
    let prev: any = 'building';
    for (const level of [5, 6, 7, 8, 9, 10, 11, 12]) {
      prev = resolveGranularity(level, prev);
      seen.push(prev);
    }
    expect(seen).toEqual([
      'building', 'building', 'building', 'dong', 'dong', 'district', 'district', 'city',
    ]);
  });

  it('경계에서 한 칸 왕복해도 단위가 바뀌지 않는다 (깜빡임 방지)', () => {
    // district(9~10) 에 있다가 8 로 내렸다 9 로 되돌리면 계속 district 여야 한다
    let g: any = 'district';
    g = resolveGranularity(8, g);
    expect(g).toBe('district');
    g = resolveGranularity(9, g);
    expect(g).toBe('district');

    // dong(7~8) 에 있다가 6 으로 내렸다 7 로 되돌려도 dong
    g = 'dong';
    g = resolveGranularity(6, g);
    expect(g).toBe('dong');
    g = resolveGranularity(7, g);
    expect(g).toBe('dong');
  });
});

describe('resolveGranularity 다단계 점프', () => {
  // 히스테리시스는 "인접 단위" 사이에서만 걸려야 한다. 카카오맵은 줌이 완전히 멈췄을 때만
  // idle 이벤트를 한 번 쏘므로, 사용자가 휠을 빠르게 굴려 building 뷰에서 city 뷰까지 단숨에
  // 축소하면 이 함수는 중간 밴드를 전혀 거치지 않고 level 과 prev 가 두 칸 이상 떨어진 조합을
  // 한 번에 받는다. resolveGranularity 의 인접 판정(`Math.abs(prevIdx - baseIdx) !== 1`)이
  // 없으면, 두 칸 이상 점프에도 히스테리시스가 걸려 도착해야 할 단위가 아니라 이전 단위를
  // 계속 반환한다 — 아래 두 테스트가 그 회귀를 잡는다. 이 줄을 지워도 나머지 테스트(위
  // '4계층' 블록 등)는 전부 통과한다: 전부 "한 칸씩" 전이만 검증하기 때문에 이 갭을 못 잡는다.
  it('building → city 로 두 칸 이상 건너뛰면 이전 단위로 되돌아가지 않고 base 를 반환한다', () => {
    expect(resolveGranularity(11, 'building')).toBe('city');
  });

  it('city → building 으로 두 칸 이상 건너뛰면 이전 단위로 되돌아가지 않고 base 를 반환한다', () => {
    expect(resolveGranularity(5, 'city')).toBe('building');
  });
});

describe('MapQuerySchema', () => {
  const valid = { level: '9', swLat: '37.4', swLng: '127.0', neLat: '37.6', neLng: '127.2' };

  it('정상 입력을 숫자로 파싱한다', () => {
    const r = MapQuerySchema.parse(valid);
    expect(r.level).toBe(9);
    expect(r.swLat).toBe(37.4);
  });

  it('bounds 를 하나라도 빠뜨리면 거부한다', () => {
    const { neLng, ...partial } = valid;
    expect(() => MapQuerySchema.parse(partial)).toThrow();
  });

  it('한국 영역 밖 좌표를 거부한다', () => {
    expect(() => MapQuerySchema.parse({ ...valid, swLat: '20' })).toThrow();
    expect(() => MapQuerySchema.parse({ ...valid, neLng: '150' })).toThrow();
  });

  it('sw 가 ne 보다 크면 거부한다', () => {
    expect(() => MapQuerySchema.parse({ ...valid, swLat: '38', neLat: '37' })).toThrow();
  });

  it('level 범위를 벗어나면 거부한다', () => {
    expect(() => MapQuerySchema.parse({ ...valid, level: '0' })).toThrow();
    expect(() => MapQuerySchema.parse({ ...valid, level: '20' })).toThrow();
  });

  it('prev 가 없어도 정상 파싱된다(하위 호환)', () => {
    const r = MapQuerySchema.parse(valid);
    expect(r.prev).toBeUndefined();
  });

  it('유효한 prev 값을 허용한다', () => {
    const r = MapQuerySchema.parse({ ...valid, prev: 'district' });
    expect(r.prev).toBe('district');
  });

  it('잘못된 prev 값을 거부한다', () => {
    expect(() => MapQuerySchema.parse({ ...valid, prev: 'bogus' })).toThrow();
  });
});

describe('resolveGranularity + prev 배선', () => {
  it('prev 를 넘기면 히스테리시스가 실제로 결과를 바꾼다', () => {
    // 이 테스트는 resolveGranularity 함수 자체의 순수 동작만 검증한다. 라우트
    // 호출부(src/routes/realEstate.ts)가 실제로 prev 를 두 번째 인자로 넘기는지는
    // 이 함수 직접 호출로는 알 수 없다 — 아래 'GET /api/real-estate/:type/map
    // (라우트)' 블록의 HTTP 레벨 테스트가 그 배선을 검증한다.
    expect(resolveGranularity(11)).toBe('city');
    expect(resolveGranularity(11, 'district')).toBe('district');
  });
});

describe('GET /api/real-estate/:type/map (라우트)', () => {
  const seoulBbox = { swLat: '37.4', swLng: '126.8', neLat: '37.7', neLng: '127.2' };
  const koreaBbox = { swLat: '33', swLng: '124', neLat: '39', neLng: '132' };

  it('prev=district 를 넘기면 히스테리시스가 걸려 level=11 에서도 district 를 유지한다 (prev 없으면 city)', async () => {
    // 이 테스트가 실패한다면 라우트 호출부(src/routes/realEstate.ts)에서
    // resolveGranularity 의 두 번째 인자(prev) 전달이 빠졌다는 뜻이다.
    const withPrev = await request(app)
      .get('/api/real-estate/apt-sale/map')
      .query({ level: 11, ...koreaBbox, prev: 'district' });
    expect(withPrev.status).toBe(200);
    expect(withPrev.body.success).toBe(true);
    expect(withPrev.body.data.granularity).toBe('district');

    const withoutPrev = await request(app)
      .get('/api/real-estate/apt-sale/map')
      .query({ level: 11, ...koreaBbox });
    expect(withoutPrev.status).toBe(200);
    expect(withoutPrev.body.success).toBe(true);
    expect(withoutPrev.body.data.granularity).toBe('city');
  });

  it('한국 영역 밖 좌표(swLat=20)는 422', async () => {
    const res = await request(app)
      .get('/api/real-estate/apt-sale/map')
      .query({ level: 9, ...seoulBbox, swLat: '20' });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('bounds 컴포넌트가 하나라도 빠지면 422', async () => {
    const { neLng: _neLng, ...partial } = seoulBbox;
    const res = await request(app)
      .get('/api/real-estate/apt-sale/map')
      .query({ level: 9, ...partial });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('prev 값이 잘못되면 422', async () => {
    const res = await request(app)
      .get('/api/real-estate/apt-sale/map')
      .query({ level: 9, ...seoulBbox, prev: 'bogus' });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('building granularity(level=5, 서울 bbox) 는 success:true 와 granularity/items/total/exact 를 포함한 envelope 을 반환한다', async () => {
    // 참고: city/district 는 최근 3개월 롤링 윈도로 집계돼 로컬 스테일 DB(최신 데이터 2026-03)에서
    // items:[] 가 나올 수 있다(정상). building 은 시간 윈도 없는 RealEstateBuildingSummary 를
    // 읽어 실제 항목이 나온다. 그래서 region item 개수가 아니라 envelope 형태만 단언한다.
    const res = await request(app)
      .get('/api/real-estate/apt-sale/map')
      .query({ level: 5, ...seoulBbox });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.granularity).toBe('building');
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(typeof res.body.data.total).toBe('number');
    expect(typeof res.body.data.exact).toBe('boolean');
  });
});
