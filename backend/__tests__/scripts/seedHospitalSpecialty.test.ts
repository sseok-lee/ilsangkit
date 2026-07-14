import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { mapSpecialtyRows } from '../../src/scripts/seedHospitalDetail.js';

describe('mapSpecialtyRows', () => {
  it('ykiho→hospitalId 매핑 후 지정분야명을 뽑는다(동일 병원 다분야는 콤마 조인)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('medicInsttDetailInfo_09');
    ws.addRow(['암호화요양기호', '요양기관명', '검색코드', '검색코드명']);
    ws.addRow(['YK1', 'A병원', '50', '척추']);
    ws.addRow(['YK1', 'A병원', '43', '관절']);
    ws.addRow(['UNK', 'B병원', '38', '안과']);
    const ykihoMap = new Map([['YK1', 'hospital-1']]);
    const recs = mapSpecialtyRows(ws, ykihoMap);
    expect(recs).toEqual([{ hospitalId: 'hospital-1', specialtyField: '척추, 관절' }]);
  });

  it('richText 셀 값에서 텍스트를 추출한다 ([object Object] 방지)', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('medicInsttDetailInfo_09');
    ws.addRow(['암호화요양기호', '요양기관명', '검색코드', '검색코드명']);
    ws.addRow(['YK1', 'A병원', '50', '척추']);
    ws.addRow(['YK1', 'A병원', '43', '관절']);
    // 검색코드명 셀을 richText 객체로 설정 (ExcelJS 실제 파일에서 흔함)
    ws.getCell(3, 4).value = { richText: [{ text: '관절' }] } as unknown as ExcelJS.CellRichTextValue;
    const ykihoMap = new Map([['YK1', 'hospital-1']]);
    const recs = mapSpecialtyRows(ws, ykihoMap);
    expect(recs).toEqual([{ hospitalId: 'hospital-1', specialtyField: '척추, 관절' }]);
    // 명시적으로 [object Object]가 아님을 검증
    expect(recs[0].specialtyField).not.toContain('[object Object]');
  });

  it('중복 분야명은 한 번만 포함한다', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('medicInsttDetailInfo_09');
    ws.addRow(['암호화요양기호', '요양기관명', '검색코드', '검색코드명']);
    ws.addRow(['YK1', 'A병원', '50', '척추']);
    ws.addRow(['YK1', 'A병원', '50', '척추']);
    const ykihoMap = new Map([['YK1', 'hospital-1']]);
    const recs = mapSpecialtyRows(ws, ykihoMap);
    expect(recs).toEqual([{ hospitalId: 'hospital-1', specialtyField: '척추' }]);
  });

  it('빈 지정분야명 행은 스킵한다', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('medicInsttDetailInfo_09');
    ws.addRow(['암호화요양기호', '요양기관명', '검색코드', '검색코드명']);
    ws.addRow(['YK1', 'A병원', '50', '']);
    const ykihoMap = new Map([['YK1', 'hospital-1']]);
    const recs = mapSpecialtyRows(ws, ykihoMap);
    expect(recs).toEqual([]);
  });
});
