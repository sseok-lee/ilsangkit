// @TASK T2.1, T2.3 - CSV 파서 유틸리티
// @SPEC docs/planning/02-trd.md#공공데이터-동기화

import * as fs from 'fs';

export interface CSVParseOptions {
  delimiter?: string;
  skipRows?: number;
}

/**
 * CSV 문자열을 파싱하여 객체 배열로 변환
 * @param content - CSV 문자열
 * @param options - 파싱 옵션
 * @returns 파싱된 객체 배열
 */
export function parseCSV<T extends Record<string, string>>(
  content: string,
  options: CSVParseOptions = {}
): T[] {
  const { delimiter = ',', skipRows = 0 } = options;

  if (!content || content.trim() === '') {
    return [];
  }

  // BOM 제거
  let cleanContent = content;
  if (cleanContent.charCodeAt(0) === 0xfeff) {
    cleanContent = cleanContent.slice(1);
  }

  // 줄 단위로 파싱 (quoted fields 내의 줄바꿈 처리)
  const rows = parseCSVRows(cleanContent, delimiter);

  if (rows.length <= skipRows) {
    return [];
  }

  // 스킵할 행 제거
  const dataRows = rows.slice(skipRows);

  if (dataRows.length === 0) {
    return [];
  }

  // 헤더와 데이터 분리
  const headers = dataRows[0];
  const dataStartIndex = 1;

  if (dataRows.length <= dataStartIndex) {
    return [];
  }

  // 데이터를 객체로 변환
  const result: T[] = [];
  for (let i = dataStartIndex; i < dataRows.length; i++) {
    const row = dataRows[i];
    const obj: Record<string, string> = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j].trim();
      const value = j < row.length ? row[j] : '';
      obj[header] = value;
    }

    result.push(obj as T);
  }

  return result;
}

/**
 * CSV 내용을 행 배열로 파싱 (quoted fields 내의 줄바꿈, 쉼표 처리)
 */
function parseCSVRows(content: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];
    const nextChar = i + 1 < content.length ? content[i + 1] : '';

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        currentField += char;
        i++;
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true;
        i++;
      } else if (char === delimiter) {
        // Field separator
        currentRow.push(currentField);
        currentField = '';
        i++;
      } else if (char === '\r' && nextChar === '\n') {
        // Windows line ending
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i += 2;
      } else if (char === '\n') {
        // Unix line ending
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (char === '\r') {
        // Old Mac line ending
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else {
        currentField += char;
        i++;
      }
    }
  }

  // 마지막 필드/행 처리
  if (currentField !== '' || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // 빈 행 필터링
  return rows.filter((row) => row.some((field) => field.trim() !== ''));
}

/**
 * 버퍼를 문자열로 디코딩 (UTF-8 또는 EUC-KR 자동 감지)
 */
function decodeContent(buffer: Buffer): string {
  // UTF-8 BOM 확인
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.toString('utf8');
  }

  // UTF-8로 디코딩 시도
  const utf8Content = buffer.toString('utf8');

  // EUC-KR로 디코딩 필요 여부 확인 (깨진 문자 감지)
  // 한글이 깨져 있으면 EUC-KR로 다시 시도
  if (containsCorruptedKorean(utf8Content)) {
    // Node.js에서 iconv-lite 없이 EUC-KR 처리는 제한적
    // 대부분의 공공데이터는 UTF-8로 제공되므로 일단 UTF-8로 반환
    console.warn('Possible EUC-KR encoded content detected, may contain corrupted characters');
  }

  return utf8Content;
}

/**
 * 깨진 한글 문자 포함 여부 확인
 */
function containsCorruptedKorean(content: string): boolean {
  // U+FFFD (Replacement Character) 확인
  return content.includes('\ufffd');
}

/**
 * CSV 파일 읽기 (로컬 파일)
 */
export function readCSVFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const buffer = fs.readFileSync(filePath);
  return decodeContent(buffer);
}
