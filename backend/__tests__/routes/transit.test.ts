import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const KAKAO_RESPONSE = {
  meta: { total_count: 2 },
  documents: [
    {
      id: '1234567',
      place_name: '강남역',
      category_name: '교통,수송 > 지하철,전철 > 수도권2호선',
      category_group_code: 'SW8',
      category_group_name: '지하철역',
      address_name: '서울 강남구 역삼동 858',
      road_address_name: '서울 강남구 테헤란로 212',
      x: '127.0276368',
      y: '37.4979502',
      distance: '234',
    },
    {
      id: '7654321',
      place_name: '신논현역',
      category_name: '교통,수송 > 지하철,전철 > 서울9호선',
      category_group_code: 'SW8',
      category_group_name: '지하철역',
      address_name: '서울 강남구 논현동',
      road_address_name: '서울 강남구 강남대로 지하 526',
      x: '127.0246',
      y: '37.5048',
      distance: '850',
    },
  ],
};

describe('GET /api/transit/nearby', () => {
  const originalKey = process.env.KAKAO_REST_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.KAKAO_REST_API_KEY = 'test-kakao-key';
  });

  afterEach(() => {
    process.env.KAKAO_REST_API_KEY = originalKey;
  });

  it('지하철역 목록을 반환한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => KAKAO_RESPONSE,
    });

    const res = await request(app)
      .get('/api/transit/nearby')
      .query({ lat: 37.4979, lng: 127.0276 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.stations).toHaveLength(2);
    expect(res.body.data.stations[0].name).toBe('강남역');
    expect(res.body.data.stations[0].line).toBe('2호선');
    expect(res.body.data.stations[0].distance).toBe(234);
    expect(res.body.data.stations[1].name).toBe('신논현역');
    expect(res.body.data.stations[1].line).toBe('9호선');
  });

  it('lat 누락 시 422를 반환한다', async () => {
    const res = await request(app)
      .get('/api/transit/nearby')
      .query({ lng: 127.0276 });

    expect(res.status).toBe(422);
  });

  it('lng 누락 시 422를 반환한다', async () => {
    const res = await request(app)
      .get('/api/transit/nearby')
      .query({ lat: 37.4979 });

    expect(res.status).toBe(422);
  });

  it('한국 좌표 범위 벗어난 경우 422를 반환한다', async () => {
    const res = await request(app)
      .get('/api/transit/nearby')
      .query({ lat: 0, lng: 127.0 });

    expect(res.status).toBe(422);
  });

  it('KAKAO_REST_API_KEY 없으면 빈 배열을 반환한다', async () => {
    delete process.env.KAKAO_REST_API_KEY;

    const res = await request(app)
      .get('/api/transit/nearby')
      .query({ lat: 37.4979, lng: 127.0276 });

    expect(res.status).toBe(200);
    expect(res.body.data.stations).toEqual([]);
  });

  it('카카오 API 실패 시 빈 배열을 반환한다', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const res = await request(app)
      .get('/api/transit/nearby')
      .query({ lat: 37.4979, lng: 127.0276 });

    expect(res.status).toBe(200);
    expect(res.body.data.stations).toEqual([]);
  });

  it('radius 파라미터를 카카오 API에 전달한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ meta: { total_count: 0 }, documents: [] }),
    });

    await request(app)
      .get('/api/transit/nearby')
      .query({ lat: 37.4979, lng: 127.0276, radius: 500 });

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('radius=500');
    expect(calledUrl).toContain('category_group_code=SW8');
  });
});
