import { describe, it, expect } from 'vitest';
import {
  transformEvChargerItem,
  type EvChargerAPIItem,
} from '../../src/services/evChargerSyncService.js';

describe('transformEvChargerItem', () => {
  const baseItem: EvChargerAPIItem = {
    statNm: '서울시청 충전소',
    statId: 'ME12345',
    chgerId: '01',
    chgerType: '7',
    addr: '서울특별시 중구 태평로1가 31',
    addrDetail: '지하주차장',
    location: 'B1 지하주차장',
    useTime: '평일 09:00~18:00',
    lat: '37.5665',
    lng: '126.9780',
    busiId: 'KT',
    bnm: 'KT',
    busiNm: 'KT EV 충전소',
    busiCall: '1588-0000',
    stat: '2',
    statUpdDt: '20240101120000',
    lastTsdt: '20240101110000',
    lastTedt: '20240101115959',
    nowTsdt: null,
    powerType: '1',
    output: '50',
    method: 'DC콤보',
    zcode: '11',
    zscode: '11140',
    kind: '11',
    kindDetail: '1101',
    parkingFree: 'Y',
    note: '테스트 안내',
    limitYn: 'N',
    limitDetail: null,
    delYn: 'N',
    delDetail: null,
    trafficYn: 'Y',
    year: '2022',
    floorNum: '1',
    floorType: 'B',
    maker: '현대일렉트릭',
  };

  it('should map fields correctly', () => {
    const result = transformEvChargerItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.name).toBe('서울시청 충전소');
    expect(result!.chgerType).toBe('7');
    expect(result!.busiNm).toBe('KT EV 충전소');
    expect(result!.busiCall).toBe('1588-0000');
    expect(result!.useTime).toBe('평일 09:00~18:00');
    expect(result!.output).toBe('50');
    expect(result!.method).toBe('DC콤보');
    expect(result!.parkingFree).toBe('Y');
    expect(result!.maker).toBe('현대일렉트릭');
    expect(result!.floorType).toBe('B');
    expect(result!.year).toBe('2022');
  });

  it('should generate sourceId as statId-chgerId', () => {
    const result = transformEvChargerItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.sourceId).toBe('ME12345-01');
    expect(result!.statId).toBe('ME12345');
    expect(result!.chgerId).toBe('01');
    expect(result!.id).toBe('ev-charger-ME12345-01');
  });

  it('should parse address to extract city and district', () => {
    const result = transformEvChargerItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.city).toBe('서울');
    expect(result!.district).toBe('중구');
    expect(result!.address).toBe('서울특별시 중구 태평로1가 31');
  });

  it('should validate coordinates within KOREA_BOUNDS', () => {
    const result = transformEvChargerItem(baseItem);

    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(37.5665, 4);
    expect(result!.lng).toBeCloseTo(126.9780, 4);
  });

  it('should return null lat/lng for coordinates outside KOREA_BOUNDS', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      lat: '10.0',
      lng: '100.0',
    };

    const result = transformEvChargerItem(item);
    expect(result).not.toBeNull();
    expect(result!.lat).toBeNull();
    expect(result!.lng).toBeNull();
  });

  it('should return null lat/lng for missing coordinates', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      lat: '',
      lng: '',
    };

    const result = transformEvChargerItem(item);
    expect(result).not.toBeNull();
    expect(result!.lat).toBeNull();
    expect(result!.lng).toBeNull();
  });

  it('should convert "null" string to null', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      limitDetail: 'null',
      delDetail: 'null',
      nowTsdt: 'null',
    };

    const result = transformEvChargerItem(item);
    expect(result).not.toBeNull();
    expect(result!.limitDetail).toBeNull();
    expect(result!.delDetail).toBeNull();
    expect(result!.nowTsdt).toBeNull();
  });

  it('should map output kW field', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      output: '100',
    };

    const result = transformEvChargerItem(item);
    expect(result).not.toBeNull();
    expect(result!.output).toBe('100');
  });

  it('should return null when statId is missing', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      statId: '',
    };

    const result = transformEvChargerItem(item);
    expect(result).toBeNull();
  });

  it('should return null when chgerId is missing', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      chgerId: '',
    };

    const result = transformEvChargerItem(item);
    expect(result).toBeNull();
  });

  it('should return null when statNm is missing', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      statNm: '',
    };

    const result = transformEvChargerItem(item);
    expect(result).toBeNull();
  });

  it('should return null when addr is missing', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      addr: '',
    };

    const result = transformEvChargerItem(item);
    expect(result).toBeNull();
  });

  it('should handle numeric stat and powerType values', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      stat: 2,
      powerType: 1,
      output: 50,
    };

    const result = transformEvChargerItem(item);
    expect(result).not.toBeNull();
    expect(result!.stat).toBe('2');
    expect(result!.powerType).toBe('1');
    expect(result!.output).toBe('50');
  });

  it('should handle empty optional fields as null', () => {
    const item: EvChargerAPIItem = {
      ...baseItem,
      note: '',
      addrDetail: '',
      location: '',
    };

    const result = transformEvChargerItem(item);
    expect(result).not.toBeNull();
    expect(result!.note).toBeNull();
    expect(result!.addrDetail).toBeNull();
    expect(result!.location).toBeNull();
  });
});
