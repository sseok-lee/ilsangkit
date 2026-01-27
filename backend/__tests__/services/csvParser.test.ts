// @TASK T2.3 - CSV 파서 테스트
// @SPEC docs/planning/02-trd.md#공공데이터-동기화

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseCSV, downloadAndExtractCSV, CSVParseOptions } from '../../src/lib/csvParser.js';

describe('csvParser', () => {
  describe('parseCSV', () => {
    it('should parse CSV string with default options', () => {
      const csvContent = `이름,나이,도시
홍길동,30,서울
김철수,25,부산`;

      const result = parseCSV(csvContent);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        이름: '홍길동',
        나이: '30',
        도시: '서울',
      });
      expect(result[1]).toEqual({
        이름: '김철수',
        나이: '25',
        도시: '부산',
      });
    });

    it('should handle quoted fields with commas', () => {
      const csvContent = `이름,주소,설명
"홍길동","서울시, 강남구","테스트, 데이터"`;

      const result = parseCSV(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        이름: '홍길동',
        주소: '서울시, 강남구',
        설명: '테스트, 데이터',
      });
    });

    it('should handle empty fields', () => {
      const csvContent = `이름,나이,도시
홍길동,,서울
,25,`;

      const result = parseCSV(csvContent);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        이름: '홍길동',
        나이: '',
        도시: '서울',
      });
      expect(result[1]).toEqual({
        이름: '',
        나이: '25',
        도시: '',
      });
    });

    it('should handle BOM character', () => {
      const csvContent = '\ufeff이름,나이\n홍길동,30';

      const result = parseCSV(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        이름: '홍길동',
        나이: '30',
      });
    });

    it('should handle Windows line endings (CRLF)', () => {
      const csvContent = '이름,나이\r\n홍길동,30\r\n김철수,25';

      const result = parseCSV(csvContent);

      expect(result).toHaveLength(2);
    });

    it('should skip rows with skipRows option', () => {
      const csvContent = `설명행
이름,나이
홍길동,30`;

      const result = parseCSV(csvContent, { skipRows: 1 });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        이름: '홍길동',
        나이: '30',
      });
    });

    it('should return empty array for empty content', () => {
      const result = parseCSV('');
      expect(result).toHaveLength(0);
    });

    it('should return empty array for header only', () => {
      const csvContent = '이름,나이,도시';
      const result = parseCSV(csvContent);
      expect(result).toHaveLength(0);
    });

    it('should handle quoted fields with newlines', () => {
      const csvContent = `이름,주소
"홍길동","서울시
강남구"`;

      const result = parseCSV(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].주소).toBe('서울시\n강남구');
    });

    it('should handle escaped quotes in quoted fields', () => {
      const csvContent = `이름,설명
"홍길동","그는 ""영웅""이다"`;

      const result = parseCSV(csvContent);

      expect(result).toHaveLength(1);
      expect(result[0].설명).toBe('그는 "영웅"이다');
    });
  });

  describe('downloadAndExtractCSV', () => {
    it('should throw error for invalid URL', async () => {
      await expect(downloadAndExtractCSV('invalid-url')).rejects.toThrow();
    });

    // Note: 실제 다운로드 테스트는 통합 테스트에서 수행
  });
});
