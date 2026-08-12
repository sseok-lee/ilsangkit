import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockFindUnique, mockFindFirst } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFindFirst: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const wifi = { findMany: mockFindMany, findUnique: mockFindUnique, findFirst: mockFindFirst };
  const client = { wifi };
  return { default: client, prisma: client };
});

vi.mock('../../src/services/viewCountService.js', () => ({
  bufferViewCount: vi.fn(),
}));

import { getWifiGroupDetail, resolveWifiGroupRedirect, getWifiGroupHeader } from '../../src/services/wifiService.js';
import { buildWifiGroupId } from '../../src/services/wifiGroup.js';

const GROUP = { name: '경의선숲길', city: '서울', district: '마포구', address: null };
const GROUP_ID = buildWifiGroupId(GROUP);

function row(over: Record<string, unknown> = {}) {
  return {
    id: 'wifi-aaaaaaaaaaaa',
    name: '경의선숲길',
    address: null,
    roadAddress: null,
    lat: 37.565236,
    lng: 126.92034,
    city: '서울',
    district: '마포구',
    bjdCode: '11440',
    groupId: GROUP_ID,
    ssid: 'SEOUL',
    installDate: '2020-05',
    serviceProvider: 'SKT',
    installLocation: '공원',
    installLocationDetail: '1구간',
    managementAgency: '서울특별시',
    phoneNumber: '02-000-0000',
    govCode: '',
    dataDate: '2026-07-01',
    sourceId: 'wifi_1',
    sourceUrl: 'https://example.test',
    viewCount: 3,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-02-01'),
    syncedAt: new Date('2026-03-01'),
    ...over,
  };
}

beforeEach(() => {
  mockFindMany.mockReset();
  mockFindUnique.mockReset();
  mockFindFirst.mockReset();
});

describe('getWifiGroupHeader', () => {
  // 상세 말고도 id 로 시설을 찾는 라우트가 더 있다(naver-blog 등).
  // 그쪽이 findUnique({id}) 만 쓰면 그룹 id 에서 404 가 난다 — 실제로 그렇게 났다.
  it('그룹 id 로 대표 행의 이름·지역을 찾는다', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'wifi-aaaaaaaaaaaa', name: '경의선숲길', city: '서울', district: '마포구',
    });

    expect(await getWifiGroupHeader(GROUP_ID)).toEqual({
      id: 'wifi-aaaaaaaaaaaa', name: '경의선숲길', city: '서울', district: '마포구',
    });
    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { groupId: GROUP_ID } }),
    );
  });

  it('그룹에 행이 없으면 null', async () => {
    mockFindFirst.mockResolvedValue(null);
    expect(await getWifiGroupHeader(GROUP_ID)).toBeNull();
  });

  it('그룹 id 형식이 아니면 조회하지 않는다', async () => {
    expect(await getWifiGroupHeader('wifi-aaaaaaaaaaaa')).toBeNull();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });
});

describe('getWifiGroupDetail', () => {
  it('그룹에 속한 AP 를 하나의 상세로 접고 AP 목록을 핀으로 싣는다', async () => {
    mockFindMany.mockResolvedValue([
      row({ id: 'wifi-aaaaaaaaaaaa', lat: 37.565236, lng: 126.92034, installLocationDetail: '1구간' }),
      row({ id: 'wifi-bbbbbbbbbbbb', lat: 37.566484, lng: 126.919214, installLocationDetail: '2구간' }),
      row({ id: 'wifi-cccccccccccc', lat: 37.544913, lng: 126.946498, installLocationDetail: '3구간' }),
    ]);

    const detail = await getWifiGroupDetail(GROUP_ID);

    expect(detail).not.toBeNull();
    expect(detail!.id).toBe(GROUP_ID);
    expect(detail!.name).toBe('경의선숲길');
    expect(detail!.details.accessPointCount).toBe(3);
    expect(detail!.details.accessPoints).toHaveLength(3);
    // 좌표만 다른 AP 들이 핀으로 보존되어야 한다 — 통합의 유일한 정보 손실 지점
    expect(detail!.details.accessPoints).toEqual([
      expect.objectContaining({ id: 'wifi-aaaaaaaaaaaa', lat: 37.565236, lng: 126.92034, installLocationDetail: '1구간' }),
      expect.objectContaining({ id: 'wifi-bbbbbbbbbbbb', lat: 37.566484, lng: 126.919214, installLocationDetail: '2구간' }),
      expect.objectContaining({ id: 'wifi-cccccccccccc', lat: 37.544913, lng: 126.946498, installLocationDetail: '3구간' }),
    ]);
  });

  it('대표 좌표는 첫 AP 가 아니라 AP 들의 중심점을 쓴다 — 29km 흩어진 그룹에서 핀이 화면 밖으로 나가지 않게', async () => {
    mockFindMany.mockResolvedValue([
      row({ id: 'wifi-a', lat: 37.0, lng: 127.0 }),
      row({ id: 'wifi-b', lat: 37.2, lng: 127.4 }),
    ]);

    const detail = await getWifiGroupDetail(GROUP_ID);

    expect(detail!.lat).toBeCloseTo(37.1, 6);
    expect(detail!.lng).toBeCloseTo(127.2, 6);
  });

  it('SSID 는 그룹 내 중복을 제거해 합친다', async () => {
    mockFindMany.mockResolvedValue([
      row({ id: 'wifi-a', ssid: 'SEOUL' }),
      row({ id: 'wifi-b', ssid: 'SEOUL' }),
      row({ id: 'wifi-c', ssid: 'SEOUL_Secure' }),
      row({ id: 'wifi-d', ssid: '' }),
    ]);

    const detail = await getWifiGroupDetail(GROUP_ID);

    expect(detail!.details.ssid).toBe('SEOUL, SEOUL_Secure');
  });

  it('좌표가 없는 AP 는 중심점 계산에서 빼고 핀에서도 뺀다', async () => {
    mockFindMany.mockResolvedValue([
      row({ id: 'wifi-a', lat: 37.0, lng: 127.0 }),
      row({ id: 'wifi-b', lat: null, lng: null }),
    ]);

    const detail = await getWifiGroupDetail(GROUP_ID);

    expect(detail!.lat).toBeCloseTo(37.0, 6);
    expect(detail!.details.accessPoints).toHaveLength(1);
    // 그래도 AP 총 개수는 실제 행 수를 보고한다
    expect(detail!.details.accessPointCount).toBe(2);
  });

  it('해당 그룹에 행이 없으면 null 을 준다', async () => {
    mockFindMany.mockResolvedValue([]);
    expect(await getWifiGroupDetail(GROUP_ID)).toBeNull();
  });

  it('그룹 id 형식이 아니면 조회하지 않는다', async () => {
    expect(await getWifiGroupDetail('wifi-aaaaaaaaaaaa')).toBeNull();
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe('resolveWifiGroupRedirect', () => {
  it('AP 상세 id 는 자기 그룹 id 로 안내한다', async () => {
    mockFindUnique.mockResolvedValue(row({ id: 'wifi-aaaaaaaaaaaa', groupId: GROUP_ID }));
    expect(await resolveWifiGroupRedirect('wifi-aaaaaaaaaaaa')).toBe(GROUP_ID);
  });

  it('groupId 가 아직 채워지지 않은 행은 리다이렉트하지 않는다 — 백필 전 배포에서 404 로 떨어지지 않게', async () => {
    mockFindUnique.mockResolvedValue(row({ id: 'wifi-aaaaaaaaaaaa', groupId: null }));
    expect(await resolveWifiGroupRedirect('wifi-aaaaaaaaaaaa')).toBeNull();
  });

  it('없는 id 는 null 을 준다', async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await resolveWifiGroupRedirect('wifi-zzzzzzzzzzzz')).toBeNull();
  });

  it('이미 그룹 id 면 리다이렉트하지 않는다 — 무한 리다이렉트 방지', async () => {
    expect(await resolveWifiGroupRedirect(GROUP_ID)).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });
});
