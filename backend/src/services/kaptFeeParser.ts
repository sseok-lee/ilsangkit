// K-apt 자료실 관리비정보 xlsx(올해 주간 파일·전년도 파일) 스트리밍 파서.
//
// 1행은 안내문, 2행이 헤더(52개), 3행부터 단지·월당 1행. 금액은 단지 전체 월 부과액(원)이고
// 문자열로 들어 있으며 지수 표기("3.7478826E8")·소수 표기("2052690.0")가 섞여 있다(2026-10-26 파일).
// 파일이 50~70MB 라 통째로 읽지 않고 행 단위로 읽어 배치로 넘긴다.
// 헤더가 바뀌면 조용히 빈 값을 넣지 않고 예외로 멈춘다.

import { Readable } from 'node:stream';
import ExcelJS from 'exceljs';
import { cellToString } from './kricSubwayFileDownloader.js';

const HEADER_ROW = 2;

/** 금액 헤더 → KaptMaintenanceFee 컬럼. 시도·시군구·읍면·동리·단지명은 KaptComplex 와 같아 저장하지 않는다. */
export const KAPT_FEE_COLUMNS = [
  ['공용관리비(합계)', 'commonTotal'],
  ['일반관리비(합계)', 'generalTotal'],
  ['인건비', 'labor'],
  ['제사무비', 'officeExpense'],
  ['제세공과금', 'taxes'],
  ['피복비', 'uniform'],
  ['교육훈련비', 'training'],
  ['차량유지비', 'vehicle'],
  ['그밖의부대비용', 'otherOverhead'],
  ['청소비', 'cleaning'],
  ['경비비', 'security'],
  ['소독비', 'disinfection'],
  ['승강기유지비', 'elevator'],
  ['지능형네트워크유지비', 'network'],
  ['수선유지비(합계)', 'repairTotal'],
  ['수선비', 'repair'],
  ['시설유지비', 'facilityMaintenance'],
  ['안전점검비', 'safetyInspection'],
  ['재해예방비', 'disasterPrevention'],
  ['위탁관리수수료', 'managementFee'],
  ['개별사용료계', 'individualTotal'],
  ['난방비(공용)', 'heatingCommon'],
  ['난방비(전용)', 'heatingPrivate'],
  ['급탕비(공용)', 'hotWaterCommon'],
  ['급탕비(전용)', 'hotWaterPrivate'],
  ['가스사용료(공용)', 'gasCommon'],
  ['가스사용료(전용)', 'gasPrivate'],
  ['전기료(공용)', 'electricityCommon'],
  ['전기료(전용)', 'electricityPrivate'],
  ['수도료(공용)', 'waterCommon'],
  ['수도료(전용)', 'waterPrivate'],
  ['TV수신료', 'tvFee'],
  ['정화조오물수수료', 'septicFee'],
  ['생활폐기물수수료', 'wasteFee'],
  ['입대의운영비', 'councilFee'],
  ['건물보험료', 'buildingInsurance'],
  ['선관위운영비', 'electionFee'],
  ['기타', 'etc'],
  ['장충금 월부과액', 'ltrCharge'],
  ['장충금 월사용액', 'ltrUsage'],
  ['장충금 총적립금액', 'ltrBalance'],
  ['장충금 적립률', 'ltrRate'],
  ['잡수입 월수입금액', 'miscIncome'],
  ['입주자기여수익', 'residentIncome'],
  ['공동기여수익', 'sharedIncome'],
] as const;

/** 원(정수)이 아닌 비율 컬럼 — 반올림하지 않는다. 원본에 27억 같은 오류값도 섞여 있다(2026 파일 53건). */
const RATE_COLUMNS = new Set<string>(['ltrRate']);

const CODE_HEADER = '단지코드';
const MONTH_HEADER = '발생년월(YYYYMM)';

export interface KaptFeeItem {
  kaptCode: string;
  /** YYYYMM */
  yearMonth: string;
  /** 금액 컬럼은 원(정수) 또는 null, ltrRate 는 원본 소수 또는 null */
  [column: string]: string | number | null;
}

export function parseFeeAmount(value: string | undefined): number | null {
  const v = (value ?? '').trim();
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseRate(value: string | undefined): number | null {
  const v = (value ?? '').trim();
  if (v === '' || !Number.isFinite(Number(v))) return null;
  return Number(v);
}

/** "202601", "202601.0" → "202601". 그 밖의 형식은 null */
function parseYearMonth(value: string | undefined): string | null {
  const v = (value ?? '').trim();
  if (!/^\d{6}(\.0+)?$/.test(v)) return null;
  return v.slice(0, 6);
}

export async function* readKaptFeeXlsx(buffer: Buffer, batchSize = 2000): AsyncGenerator<KaptFeeItem[]> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from(buffer), {
    sharedStrings: 'cache',
    worksheets: 'emit',
    hyperlinks: 'ignore',
    styles: 'ignore',
  });
  // exceljs 4.4: zip 안에서 시트가 workbook.xml 보다 앞이면 this.model 이 없어 _parseWorksheet 가 죽는다.
  // 시트 이름은 쓰지 않으므로 빈 모델을 먼저 넣어 둔다(workbook.xml 을 만나면 덮어쓴다).
  (reader as unknown as { model?: unknown }).model ??= { sheets: [] };

  for await (const sheet of reader) {
    let columns: Map<string, number> | null = null;
    let batch: KaptFeeItem[] = [];
    for await (const row of sheet) {
      if (row.number < HEADER_ROW) continue;
      if (row.number === HEADER_ROW) {
        columns = new Map();
        row.eachCell((cell, col) => {
          const name = cellToString(cell.value).trim();
          if (name !== '') columns!.set(name, col);
        });
        const required = [CODE_HEADER, MONTH_HEADER, ...KAPT_FEE_COLUMNS.map(([header]) => header)];
        const missing = required.filter((h) => !columns!.has(h));
        if (missing.length > 0) {
          throw new Error(`K-apt 관리비 파일 헤더 누락: ${missing.join(', ')} — 제공처 스키마 변경 여부 확인 필요`);
        }
        continue;
      }
      if (!columns) throw new Error('K-apt 관리비 파일 헤더 행을 찾지 못했다');
      const cell = (header: string): string => cellToString(row.getCell(columns!.get(header)!).value).trim();

      const kaptCode = cell(CODE_HEADER);
      const yearMonth = parseYearMonth(cell(MONTH_HEADER));
      if (kaptCode === '' || !yearMonth) continue;
      const item: KaptFeeItem = { kaptCode, yearMonth };
      for (const [header, column] of KAPT_FEE_COLUMNS) {
        item[column] = RATE_COLUMNS.has(column) ? parseRate(cell(header)) : parseFeeAmount(cell(header));
      }
      batch.push(item);
      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }
    if (!columns) throw new Error('K-apt 관리비 파일 헤더 행을 찾지 못했다');
    if (batch.length > 0) yield batch;
    // 첫 워크시트만 읽는다
    return;
  }
  throw new Error('워크시트 없음');
}
