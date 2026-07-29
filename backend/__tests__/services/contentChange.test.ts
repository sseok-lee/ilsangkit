import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { hasContentChanged, valuesDiffer, DECIMAL_SCALE } from '../../src/services/contentChange.js';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('valuesDiffer — 기본', () => {
  it('같은 문자열은 변경 아님', () => {
    expect(valuesDiffer('서울대병원', '서울대병원')).toBe(false);
  });

  it('다른 문자열은 변경', () => {
    expect(valuesDiffer('서울대병원', '연세대병원')).toBe(true);
  });

  it('같은 숫자는 변경 아님', () => {
    expect(valuesDiffer(42, 42)).toBe(false);
  });

  it('다른 숫자는 변경', () => {
    expect(valuesDiffer(42, 43)).toBe(true);
  });
});

describe('valuesDiffer — NULL 취급', () => {
  // 공공데이터는 NULL 필드가 흔하다. null 과 undefined 를 다르게 보면
  // 값이 없는 필드가 매번 "변경됨"으로 잡힌다.
  it('null 과 undefined 는 같게 본다', () => {
    expect(valuesDiffer(null, undefined)).toBe(false);
    expect(valuesDiffer(undefined, null)).toBe(false);
  });

  it('null 끼리는 변경 아님', () => {
    expect(valuesDiffer(null, null)).toBe(false);
  });

  it('null → 값 은 변경', () => {
    expect(valuesDiffer(null, '02-1234-5678')).toBe(true);
  });

  it('값 → null 은 변경', () => {
    expect(valuesDiffer('02-1234-5678', null)).toBe(true);
  });

  it('빈 문자열과 null 은 다르게 본다 — 실제로 다른 상태다', () => {
    expect(valuesDiffer('', null)).toBe(true);
  });
});

describe('valuesDiffer — Decimal(10,7) 좌표', () => {
  // ★ 여기가 가장 중요하다.
  // Prisma 는 Decimal 컬럼을 Decimal 객체로 돌려주는데 소스 데이터는 number/string 이다.
  // 이 비교가 틀리면 lat/lng 이 있는 "모든" 행이 매 sync 마다 변경으로 잡혀
  // updatedAt 조건화가 통째로 무의미해진다.
  it('Decimal 과 동일 값 number 는 변경 아님', () => {
    expect(valuesDiffer(D('37.1234567'), 37.1234567)).toBe(false);
  });

  it('Decimal 과 동일 값 string 은 변경 아님', () => {
    expect(valuesDiffer(D('37.1234567'), '37.1234567')).toBe(false);
  });

  it('소스가 컬럼 스케일보다 정밀해도 변경 아님 — DB 가 반올림해 저장한 값과 같다', () => {
    // Decimal(10,7) 은 소수 7자리. 37.12345674 는 저장 시 37.1234567 이 된다.
    expect(valuesDiffer(D('37.1234567'), 37.12345674)).toBe(false);
  });

  it('스케일 내에서 실제로 다르면 변경', () => {
    expect(valuesDiffer(D('37.1234567'), 37.1234568)).toBe(true);
  });

  it('좌표가 크게 바뀌면 변경', () => {
    expect(valuesDiffer(D('37.1234567'), 35.9)).toBe(true);
  });

  it('Decimal 과 null 비교', () => {
    expect(valuesDiffer(D('37.1'), null)).toBe(true);
    expect(valuesDiffer(null, 37.1)).toBe(true);
  });

  it('스케일 상수는 스키마의 Decimal(10,7) 과 일치한다', () => {
    expect(DECIMAL_SCALE).toBe(7);
  });
});

describe('valuesDiffer — Date', () => {
  it('같은 시각은 변경 아님', () => {
    expect(valuesDiffer(new Date('2026-07-29T00:00:00Z'), new Date('2026-07-29T00:00:00Z'))).toBe(false);
  });

  it('다른 시각은 변경', () => {
    expect(valuesDiffer(new Date('2026-07-29T00:00:00Z'), new Date('2026-07-30T00:00:00Z'))).toBe(true);
  });
});

describe('hasContentChanged', () => {
  it('next 의 키만 비교한다 — existing 의 다른 컬럼은 무시', () => {
    const existing = { name: '서울대병원', phone: '02-1', updatedAt: new Date(), viewCount: 999 };
    expect(hasContentChanged(existing, { name: '서울대병원' })).toBe(false);
  });

  it('한 필드라도 다르면 변경', () => {
    const existing = { name: '서울대병원', phone: '02-1', lat: D('37.1234567') };
    expect(hasContentChanged(existing, { name: '서울대병원', phone: '02-2', lat: 37.1234567 })).toBe(true);
  });

  it('전부 같으면 변경 아님 (좌표 포함)', () => {
    const existing = { name: '서울대병원', phone: '02-1', lat: D('37.1234567'), lng: D('127.0000001') };
    expect(hasContentChanged(existing, {
      name: '서울대병원', phone: '02-1', lat: 37.1234567, lng: 127.0000001,
    })).toBe(false);
  });

  it('existing 에 없는 키가 next 에 있으면 변경으로 본다', () => {
    expect(hasContentChanged({ name: 'A' }, { name: 'A', phone: '02-1' })).toBe(true);
  });

  it('빈 next 는 변경 아님', () => {
    expect(hasContentChanged({ name: 'A' }, {})).toBe(false);
  });
});
