// @TASK T3 - library TN API 영문 필드명 마이그레이션 테스트
// data.go.kr TN 표준데이터 API가 한글 필드명 → 영문 필드명으로 전환됨에 따라
// transformLibraryRow가 영문 키(lbrryNm, ctprvnNm, signguNm, latitude, longitude 등)를
// 올바르게 읽는지 검증한다.

import { describe, it, expect } from 'vitest';
import { transformLibraryRow, LibraryCSVRow } from '../../src/services/csvParser';

describe('CSV Parser - transformLibraryRow (TN API 영문 필드명)', () => {
  it('should transform an English-field API row into Library format', () => {
    const row: LibraryCSVRow = {
      lbrryNm: '○○도서관',
      ctprvnNm: '광주',
      signguNm: '북구',
      rdnmadr: '광주광역시 북구 어딘가로 123',
      latitude: '35.18',
      longitude: '126.9',
      lbrrySe: '공공도서관',
      closeDay: '매주 월요일',
      weekdayOperOpenHhmm: '09:00',
      weekdayOperColseHhmm: '18:00',
      satOperOperOpenHhmm: '09:00',
      satOperCloseHhmm: '13:00',
      holidayOperOpenHhmm: '10:00',
      holidayCloseOpenHhmm: '15:00',
      seatCo: '100',
      bookCo: '50000',
      pblictnCo: '300',
      noneBookCo: '200',
      lonCo: '5',
      lonDaycnt: '14',
      phoneNumber: '062-123-4567',
      homepageUrl: 'https://lib.example.kr',
      operInstitutionNm: '광주광역시 북구청',
      plotAr: '1200',
      buldAr: '800',
      referenceDate: '2025-01-01',
      insttCode: '1234567',
      insttNm: '광주광역시 북구청',
    };

    const library = transformLibraryRow(row);

    expect(library).not.toBeNull();
    expect(library!.name).toBe('○○도서관');
    // 2026 통합: 광주 → 전남광주통합특별시로 정규화 (재드리프트 방지, Task A2)
    expect(library!.city).toBe('전남광주통합특별시');
    expect(library!.district).toBe('북구');
    expect(library!.lat).toBeCloseTo(35.18, 5);
    expect(library!.lng).toBeCloseTo(126.9, 5);
    expect(library!.seatCount).toBe(100);
    expect(library!.bookCount).toBe(50000);
    expect(library!.serialCount).toBe(300);
    expect(library!.nonBookCount).toBe(200);
    expect(library!.loanableBooks).toBe(5);
    expect(library!.loanableDays).toBe(14);
    expect(library!.libraryType).toBe('공공도서관');
    expect(library!.closedDays).toBe('매주 월요일');
    expect(library!.weekdayOpenTime).toBe('09:00');
    expect(library!.weekdayCloseTime).toBe('18:00');
    expect(library!.saturdayOpenTime).toBe('09:00');
    expect(library!.saturdayCloseTime).toBe('13:00');
    expect(library!.holidayOpenTime).toBe('10:00');
    expect(library!.holidayCloseTime).toBe('15:00');
    expect(library!.phoneNumber).toBe('062-123-4567');
    expect(library!.homepageUrl).toBe('https://lib.example.kr');
    expect(library!.operatingOrg).toBe('광주광역시 북구청');
    expect(library!.lotArea).toBe('1200');
    expect(library!.buildingArea).toBe('800');
    expect(library!.dataDate).toBe('2025-01-01');
    expect(library!.providerCode).toBe('1234567');
    expect(library!.providerName).toBe('광주광역시 북구청');
  });

  it('should return null when city or district is missing', () => {
    const row: LibraryCSVRow = {
      lbrryNm: '△△도서관',
      ctprvnNm: '',
      signguNm: '',
      rdnmadr: '',
      latitude: '35.18',
      longitude: '126.9',
    };

    expect(transformLibraryRow(row)).toBeNull();
  });
});
