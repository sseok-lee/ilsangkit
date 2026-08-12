/**
 * wifi 상세를 "장소 단위"로 접기 위한 그룹 키 유틸.
 *
 * 배경: 원본(공공데이터 표준 무료와이파이)은 AP 1대 = 1행이다. 한 장소에 AP 가 여러 대면
 * 그만큼 상세 페이지가 생기는데, 좌표 말고는 사용자에게 보이는 값이 전부 같다
 * (라이브 실측: 경의선숲길 20개 페이지의 본문 텍스트가 완전 동일, 좌표만 다름).
 * 그 결과 네이버 사이트 진단의 "동일 설명문" 에 wifi 가 대량으로 잡힌다
 * (2026-08 실측: 전체 행의 44.7% 가 다건 그룹에 속함).
 *
 * 그래서 ev-charger 가 statId 로 충전소를 접는 것과 같은 방식으로 wifi 도 장소로 접는다.
 * 다만 wifi 원본에는 statId 같은 장소 식별자가 없어서 (name, city, district, address) 로 만든다.
 *
 * ⚠️ address 를 키에 반드시 포함할 것. (name, city, district) 만으로 묶으면
 * name 이 건물명이 아닌 행 —— '버스정류장'(파주시 194개 AP, 주소 166종, 반경 29km),
 * '충청북도 청주시'(547개, 반경 37km) —— 이 하나로 오병합된다. address 를 넣으면
 * 반경 5km 초과 위험 그룹이 236개 → 34개로 줄어든다.
 */
import { createHash } from 'crypto';

export interface WifiGroupKeyInput {
  name: string;
  city: string;
  district: string;
  address: string | null;
}

export interface WifiGroupKeyParts {
  name: string;
  city: string;
  district: string;
  address: string;
}

/**
 * 그룹 키 구성요소를 정규화한다.
 *
 * SQL 쪽 GROUP BY 와 앱 쪽 해시 계산이 어긋나면 상세 URL 이 어떤 행에도 매칭되지 않으므로,
 * 양쪽 모두 이 함수(및 대응하는 SQL 표현식)를 통해서만 키를 만든다.
 * NULL 과 빈 문자열은 같은 값으로 접는다 — 원본에 주소가 통째로 비는 장소가 있고
 * (에스플렉스센터 179개 AP 전부 address NULL), 그 경우도 한 페이지로 묶여야 한다.
 */
export function wifiGroupKeyParts(input: WifiGroupKeyInput): WifiGroupKeyParts {
  return {
    name: (input.name ?? '').trim(),
    city: (input.city ?? '').trim(),
    district: (input.district ?? '').trim(),
    address: (input.address ?? '').trim(),
  };
}

/**
 * 장소 단위 그룹 id 를 만든다.
 *
 * 형식은 `wifi-g<hex12>`. 접두사를 `wifi-` 로 유지하는 건 의도적이다 —
 * robots.txt 의 AI 크롤러 차단 규칙이 `Disallow: /wifi/wifi-` 라서,
 * 다른 접두사를 쓰면 그 규칙만 조용히 빠져나간다.
 * 기존 AP 상세 id 는 `wifi-<hex12>` 이고 hex 에 'g' 가 없으므로 네임스페이스가 겹치지 않는다.
 */
export function buildWifiGroupId(input: WifiGroupKeyInput): string {
  const parts = wifiGroupKeyParts(input);
  // 구분자를 이스케이프한다. 값 안에 '|' 가 들어와도 서로 다른 키가 같은 문자열로
  // 접히지 않도록 — 예: ('가|나','다') 와 ('가','나|다').
  const key = [parts.name, parts.city, parts.district, parts.address]
    .map((v) => v.replace(/\\/g, '\\\\').replace(/\|/g, '\\|'))
    .join('|');
  const hash = createHash('md5').update(key).digest('hex').substring(0, 12);
  return `wifi-g${hash}`;
}

/** 주어진 id 가 장소 단위 그룹 id 인지 판별한다. */
export function isWifiGroupId(id: string): boolean {
  return /^wifi-g[0-9a-f]{12}$/.test(id);
}
