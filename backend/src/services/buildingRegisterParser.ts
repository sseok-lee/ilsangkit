// 건축HUB 대용량 파일(건축물대장 표제부 0303 · 총괄표제부 0302 · 전유공용면적 0306) 한 줄 → 저장 행.
//
// 형식(2026-10-29 실측): UTF-8, 구분자 '|', 머리글 없음, 열 순서 = 레이아웃 순서.
// 열 이름은 건축HUB 레이아웃(idx-lgcpt-pvsn-srvc-popup.do)의 colLogicNm 그대로이며 raw JSON 의 키로도 쓴다.

export const TITLE_COLUMNS = [
  '관리_건축물대장_PK', '대장_구분_코드', '대장_구분_코드_명', '대장_종류_코드', '대장_종류_코드_명', '대지_위치',
  '도로명_대지_위치', '건물_명', '시군구_코드', '법정동_코드', '대지_구분_코드', '번', '지', '특수지_명', '블록', '로트',
  '외필지_수', '새주소_도로_코드', '새주소_법정동_코드', '새주소_지상지하_코드', '새주소_본_번', '새주소_부_번', '동_명',
  '주_부속_구분_코드', '주_부속_구분_코드_명', '대지_면적(㎡)', '건축_면적(㎡)', '건폐_율(%)', '연면적(㎡)',
  '용적_률_산정_연면적(㎡)', '용적_률(%)', '구조_코드', '구조_코드_명', '기타_구조', '주_용도_코드', '주_용도_코드_명',
  '기타_용도', '지붕_코드', '지붕_코드_명', '기타_지붕', '세대_수(세대)', '가구_수(가구)', '높이(m)', '지상_층_수',
  '지하_층_수', '승용_승강기_수', '비상용_승강기_수', '부속_건축물_수', '부속_건축물_면적(㎡)', '총_동_연면적(㎡)',
  '옥내_기계식_대수(대)', '옥내_기계식_면적(㎡)', '옥외_기계식_대수(대)', '옥외_기계식_면적(㎡)', '옥내_자주식_대수(대)',
  '옥내_자주식_면적(㎡)', '옥외_자주식_대수(대)', '옥외_자주식_면적(㎡)', '허가_일', '착공_일', '사용승인_일',
  '허가번호_년', '허가번호_기관_코드', '허가번호_기관_코드_명', '허가번호_구분_코드', '허가번호_구분_코드_명', '호_수(호)',
  '에너지효율_등급', '에너지절감_율', '에너지_EPI점수', '친환경_건축물_등급', '친환경_건축물_인증점수',
  '지능형_건축물_등급', '지능형_건축물_인증점수', '생성_일자', '내진_설계_적용_여부', '내진_능력',
] as const;

export const RECAP_COLUMNS = [
  '관리_건축물대장_PK', '대장_구분_코드', '대장_구분_코드_명', '대장_종류_코드', '대장_종류_코드_명',
  '신_구_대장_구분_코드', '신_구_대장_구분_코드_명', '대지_위치', '도로명_대지_위치', '건물_명', '시군구_코드',
  '법정동_코드', '대지_구분_코드', '번', '지', '특수지_명', '블록', '로트', '외필지_수', '새주소_도로_코드',
  '새주소_법정동_코드', '새주소_지상지하_코드', '새주소_본_번', '새주소_부_번', '대지_면적(㎡)', '건축_면적(㎡)',
  '건폐_율(%)', '연면적(㎡)', '용적_률_산정_연면적(㎡)', '용적_률(%)', '주_용도_코드', '주_용도_코드_명', '기타_용도',
  '세대_수(세대)', '가구_수(가구)', '주_건축물_수', '부속_건축물_수', '부속_건축물_면적(㎡)', '총_주차_수',
  '옥내_기계식_대수(대)', '옥내_기계식_면적(㎡)', '옥외_기계식_대수(대)', '옥외_기계식_면적(㎡)', '옥내_자주식_대수(대)',
  '옥내_자주식_면적(㎡)', '옥외_자주식_대수(대)', '옥외_자주식_면적(㎡)', '허가_일', '착공_일', '사용승인_일',
  '허가번호_년', '허가번호_기관_코드', '허가번호_기관_코드_명', '허가번호_구분_코드', '허가번호_구분_코드_명', '호_수(호)',
  '에너지효율_등급', '에너지절감_율', '에너지_EPI점수', '친환경_건축물_등급', '친환경_건축물_인증점수',
  '지능형_건축물_등급', '지능형_건축물_인증점수', '생성_일자',
] as const;

export const UNIT_COLUMNS = [
  '관리_건축물대장_PK', '대장_구분_코드', '대장_구분_코드_명', '대장_종류_코드', '대장_종류_코드_명', '대지_위치',
  '도로명_대지_위치', '건물_명', '시군구_코드', '법정동_코드', '대지_구분_코드', '번', '지', '특수지_명', '블록', '로트',
  '새주소_도로_코드', '새주소_법정동_코드', '새주소_지상지하_코드', '새주소_본_번', '새주소_부_번', '동_명', '호_명',
  '층_구분_코드', '층_구분_코드_명', '층_번호', '전유_공용_구분_코드', '전유_공용_구분_코드_명', '주_부속_구분_코드',
  '주_부속_구분_코드_명', '층_번호_명', '구조_코드', '구조_코드_명', '기타_구조', '주_용도_코드', '주_용도_코드_명',
  '기타_용도', '면적(㎡)', '생성_일자',
] as const;

export interface ParcelKey {
  sggCode: string;
  bjdongCode: string;
  /** 0 대지 / 1 산 / 2 블록 */
  platGbCd: string;
  /** 4자리 */
  bun: string;
  /** 4자리 */
  ji: string;
}

export interface TitleRow extends ParcelKey {
  mgmPk: string;
  bldNm: string | null;
  dongNm: string | null;
  regstrGbCd: string;
  regstrKindCd: string;
  mainAtchGbCd: string;
  mainPurpsCd: string | null;
  mainPurpsCdNm: string | null;
  etcPurps: string | null;
  hhldCnt: number | null;
  fmlyCnt: number | null;
  hoCnt: number | null;
  grndFlrCnt: number | null;
  ugrndFlrCnt: number | null;
  elevatorCnt: number | null;
  parkingCnt: number | null;
  useAprDay: string | null;
  strctCdNm: string | null;
  sourceMonth: string;
  raw: Record<string, string>;
}

export interface RecapRow extends ParcelKey {
  mgmPk: string;
  bldNm: string | null;
  mainPurpsCdNm: string | null;
  hhldCnt: number | null;
  fmlyCnt: number | null;
  hoCnt: number | null;
  mainBldCnt: number | null;
  totPkngCnt: number | null;
  useAprDay: string | null;
  sourceMonth: string;
  raw: Record<string, string>;
}

export interface UnitRow {
  key: ParcelKey;
  bldNm: string;
  dongNm: string;
  hoNm: string;
  isExclusive: boolean;
  isOffitel: boolean;
}

/** 열 수가 맞으면 배열, 끝에 빈 열이 하나 더 붙은 줄은 그것만 떼고, 그 외는 null(건너뛸 줄). */
export function splitRow(line: string, expected: number): string[] | null {
  const cols = line.split('|');
  if (cols.length === expected) return cols;
  if (cols.length === expected + 1 && cols[expected] === '') return cols.slice(0, expected);
  return null;
}

export function parcelKeyString(key: ParcelKey): string {
  return `${key.sggCode}|${key.bjdongCode}|${key.platGbCd}|${key.bun}|${key.ji}`;
}

const text = (value: string | undefined, max: number): string | null => {
  const v = (value ?? '').trim();
  return v === '' ? null : v.slice(0, max);
};

const int = (value: string | undefined): number | null => {
  const v = (value ?? '').trim();
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};

const sum = (values: Array<number | null>): number | null =>
  values.every((v) => v === null) ? null : values.reduce<number>((acc, v) => acc + (v ?? 0), 0);

const ymd = (value: string | undefined): string | null => {
  const v = (value ?? '').trim();
  return /^\d{8}$/.test(v) ? v : null;
};

function toRaw(names: readonly string[], cols: string[]): Record<string, string> {
  const raw: Record<string, string> = {};
  names.forEach((name, i) => { raw[name] = cols[i] ?? ''; });
  return raw;
}

/** 레이아웃 번호(1부터)로 읽는다 */
const at = (cols: string[], no: number): string => cols[no - 1] ?? '';

function parcel(cols: string[], sgg: number): ParcelKey {
  return {
    sggCode: at(cols, sgg).trim(),
    bjdongCode: at(cols, sgg + 1).trim(),
    platGbCd: at(cols, sgg + 2).trim() || '0',
    bun: at(cols, sgg + 3).trim().padStart(4, '0'),
    ji: at(cols, sgg + 4).trim().padStart(4, '0'),
  };
}

export function parseTitleRow(cols: string[], sourceMonth: string): TitleRow {
  return {
    mgmPk: at(cols, 1).trim().slice(0, 33),
    ...parcel(cols, 9),
    bldNm: text(at(cols, 8), 200),
    dongNm: text(at(cols, 23), 100),
    regstrGbCd: at(cols, 2).trim(),
    regstrKindCd: at(cols, 4).trim(),
    mainAtchGbCd: at(cols, 24).trim(),
    mainPurpsCd: text(at(cols, 35), 10),
    mainPurpsCdNm: text(at(cols, 36), 100),
    etcPurps: text(at(cols, 37), 500),
    hhldCnt: int(at(cols, 41)),
    fmlyCnt: int(at(cols, 42)),
    hoCnt: int(at(cols, 67)),
    grndFlrCnt: int(at(cols, 44)),
    ugrndFlrCnt: int(at(cols, 45)),
    elevatorCnt: sum([int(at(cols, 46)), int(at(cols, 47))]),
    parkingCnt: sum([int(at(cols, 51)), int(at(cols, 53)), int(at(cols, 55)), int(at(cols, 57))]),
    useAprDay: ymd(at(cols, 61)),
    strctCdNm: text(at(cols, 33), 100),
    sourceMonth,
    raw: toRaw(TITLE_COLUMNS, cols),
  };
}

export function parseRecapRow(cols: string[], sourceMonth: string): RecapRow {
  return {
    mgmPk: at(cols, 1).trim().slice(0, 33),
    ...parcel(cols, 11),
    bldNm: text(at(cols, 10), 200),
    mainPurpsCdNm: text(at(cols, 32), 100),
    hhldCnt: int(at(cols, 34)),
    fmlyCnt: int(at(cols, 35)),
    hoCnt: int(at(cols, 56)),
    mainBldCnt: int(at(cols, 36)),
    totPkngCnt: int(at(cols, 39)),
    useAprDay: ymd(at(cols, 50)),
    sourceMonth,
    raw: toRaw(RECAP_COLUMNS, cols),
  };
}

export function parseUnitRow(cols: string[]): UnitRow {
  return {
    key: parcel(cols, 9),
    bldNm: at(cols, 8).trim().slice(0, 200),
    dongNm: at(cols, 22).trim().slice(0, 100),
    hoNm: at(cols, 23).trim(),
    isExclusive: at(cols, 27).trim() === '1',
    isOffitel: isOffitelPurpose(text(at(cols, 36), 100), text(at(cols, 37), 500)),
  };
}

/** 집합 대장(아파트·연립·다세대·오피스텔) 전부 + 일반 대장 중 주용도 공동주택(02xxx) */
export function shouldKeepTitle(row: Pick<TitleRow, 'regstrGbCd' | 'mainPurpsCd'>): boolean {
  if (row.regstrGbCd === '2') return true;
  return row.mainPurpsCd?.startsWith('02') ?? false;
}

export function isOffitelPurpose(mainName: string | null, etcPurps: string | null): boolean {
  return Boolean(mainName?.includes('오피스텔') || etcPurps?.includes('오피스텔'));
}

const JIBUN_TOKEN = /^(산)?\d+(-\d+)?(번지)?$/;

/**
 * 대지위치 → 실거래 dongName 후보. 지번 바로 앞 토큰이 법정동(동·가·리).
 * "… 오송읍 서평리 123번지" 처럼 리면 "서평리" 와 "오송읍 서평리" 둘 다 돌려준다.
 */
export function dongNamesFromPlatPlc(platPlc: string): string[] {
  const tokens = platPlc.trim().split(/\s+/).filter(Boolean);
  const jibunAt = tokens.findIndex((t, i) => JIBUN_TOKEN.test(t) || (t === '산' && /^\d/.test(tokens[i + 1] ?? '')));
  if (jibunAt < 1) return [];
  const dong = tokens[jibunAt - 1];
  const before = tokens[jibunAt - 2];
  if (dong.endsWith('리') && before && /[읍면]$/.test(before)) return [dong, `${before} ${dong}`];
  return [dong];
}
