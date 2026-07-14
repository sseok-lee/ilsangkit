import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { mapEquipmentRows } from '../../src/scripts/seedHospitalDetail.js';

async function makeSheet(rows: string[][]): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('medicInsttDetailInfo_05');
  ws.addRow(['암호화요양기호', '요양기관명', '장비코드', '장비코드명', '장비대수']);
  rows.forEach((r) => ws.addRow(r));
  return ws;
}

describe('mapEquipmentRows', () => {
  it('ykiho→hospitalId 매핑 후 (hospitalId, eqpCd) 레코드 생성', async () => {
    const ws = await makeSheet([
      ['YK1', 'A병원', 'B302', '초음파영상진단기', '2'],
      ['YK2', 'B병원', 'C201', 'CT', '1'],
      ['UNKNOWN', 'C병원', 'D101', 'MRI', '1'],
    ]);
    const ykihoMap = new Map([['YK1', 'hospital-1'], ['YK2', 'hospital-2']]);
    const recs = mapEquipmentRows(ws, ykihoMap);
    expect(recs).toEqual([
      { hospitalId: 'hospital-1', eqpCd: 'B302', eqpCdNm: '초음파영상진단기', eqpCnt: 2 },
      { hospitalId: 'hospital-2', eqpCd: 'C201', eqpCdNm: 'CT', eqpCnt: 1 },
    ]);
  });
});
