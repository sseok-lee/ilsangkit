import { describe, it, expect, vi } from 'vitest';
import {
  cleanAuctionAddress,
  extractAddressCore,
  geocodeAuctionAddress,
} from '../../src/scripts/geocodeAuction.js';

describe('cleanAuctionAddress', () => {
  it('괄호 이하 제거', () => {
    expect(cleanAuctionAddress('경주시 감포읍 오류리 281-1(근생 및 오피스텔)')).toBe('경주시 감포읍 오류리 281-1');
  });
  it('"외 N필지" 이하 제거', () => {
    expect(cleanAuctionAddress('경주시 감포읍 오류리 281-1 외 2필지 및 레지던스')).toBe('경주시 감포읍 오류리 281-1');
  });
  it('정상 주소는 그대로', () => {
    expect(cleanAuctionAddress('경기도 화성시 서신면 송교리 366')).toBe('경기도 화성시 서신면 송교리 366');
  });
});

describe('extractAddressCore', () => {
  it('동/리 + 지번 추출(뒤 설명 제거)', () => {
    expect(extractAddressCore('경기도 화성시 남양읍 신남리 산10-2 임야')).toBe('경기도 화성시 남양읍 신남리 산10-2');
  });
  it('건물명·호수 꼬리 제거', () => {
    expect(extractAddressCore('서울특별시 송파구 가락동 77 서울가락본동우체국 3층')).toBe('서울특별시 송파구 가락동 77');
  });
  it('"산 10-2" 공백 정규화', () => {
    expect(extractAddressCore('경기도 화성시 남양읍 신남리 산 10-2')).toBe('경기도 화성시 남양읍 신남리 산10-2');
  });
  it('매칭 불가 시 null', () => {
    expect(extractAddressCore('주소불명')).toBeNull();
  });
});

describe('geocodeAuctionAddress (전략 순서)', () => {
  it('1순위 core 주소검색 성공 시 즉시 반환', async () => {
    const addr = vi.fn().mockResolvedValue({ lat: 37.1, lng: 126.6 });
    const kw = vi.fn();
    const r = await geocodeAuctionAddress('경기도 화성시 서신면 송교리 366 임야', { addr, kw });
    expect(r).toEqual({ lat: 37.1, lng: 126.6 });
    expect(addr).toHaveBeenCalledTimes(1); // core에서 성공 → clean 재시도 안 함
    expect(kw).not.toHaveBeenCalled();
  });
  it('core 실패 → clean 주소검색 → keyword 순으로 폴백', async () => {
    const addr = vi.fn().mockResolvedValue(null);
    const kw = vi.fn().mockResolvedValue({ lat: 1, lng: 2 });
    const r = await geocodeAuctionAddress('경주시 감포읍 오류리 281-1 외 2필지(레지던스)', { addr, kw });
    expect(r).toEqual({ lat: 1, lng: 2 });
    expect(addr).toHaveBeenCalled();
    expect(kw).toHaveBeenCalledTimes(1);
  });
  it('전부 실패 시 null', async () => {
    const r = await geocodeAuctionAddress('주소불명', { addr: vi.fn().mockResolvedValue(null), kw: vi.fn().mockResolvedValue(null) });
    expect(r).toBeNull();
  });
});
