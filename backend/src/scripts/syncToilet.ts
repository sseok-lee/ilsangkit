#!/usr/bin/env tsx
// @TASK T2.1 - 공공화장실 데이터 동기화 스크립트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as AdmZipModule from 'adm-zip';
const AdmZip = AdmZipModule.default || AdmZipModule;
import { syncToilets } from '../services/toiletSyncService.js';

// 공공화장실 CSV 다운로드 URL
const TOILET_CSV_URL = 'https://www.localdata.go.kr/datafile/each/07_24_05_P_CSV.zip';

// 임시 다운로드 디렉토리
const TEMP_DIR = path.join(process.cwd(), 'temp');
const ZIP_PATH = path.join(TEMP_DIR, 'toilet-data.zip');
const EXTRACT_DIR = path.join(TEMP_DIR, 'toilet-data');

/**
 * 디렉토리 생성 (존재하지 않는 경우)
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 파일 다운로드
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.info(`Downloading from: ${url}`);

    const protocol = url.startsWith('https') ? https : http;

    const file = fs.createWriteStream(destPath);

    const request = protocol.get(url, (response) => {
      // 리다이렉트 처리
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          console.info(`Redirecting to: ${redirectUrl}`);
          file.close();
          fs.unlinkSync(destPath);
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`Download failed with status: ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;

      response.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        if (totalSize > 0) {
          const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
          process.stdout.write(`\rDownloading... ${percent}%`);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.info('\nDownload completed!');
        resolve();
      });
    });

    request.on('error', (err) => {
      file.close();
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

/**
 * ZIP 파일 압축 해제
 */
function extractZip(zipPath: string, destDir: string): string[] {
  console.info('Extracting ZIP file...');

  ensureDir(destDir);

  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  const csvFiles: string[] = [];

  for (const entry of entries) {
    if (entry.entryName.endsWith('.csv')) {
      const destPath = path.join(destDir, entry.entryName);
      zip.extractEntryTo(entry, destDir, false, true);
      csvFiles.push(destPath);
      console.info(`Extracted: ${entry.entryName}`);
    }
  }

  return csvFiles;
}

/**
 * 임시 파일 정리
 */
function cleanup(): void {
  console.info('Cleaning up temporary files...');

  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    console.info('Cleanup completed!');
  }
}

/**
 * 로컬 CSV 파일로 동기화 (개발/테스트용)
 */
async function syncFromLocalFile(csvPath: string): Promise<void> {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  console.info(`Using local CSV file: ${csvPath}`);
  await syncToilets(csvPath);
}

/**
 * 메인 함수
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // 로컬 파일 모드 체크
  const localFileIndex = args.indexOf('--local');
  if (localFileIndex !== -1 && args[localFileIndex + 1]) {
    const localPath = args[localFileIndex + 1];
    await syncFromLocalFile(localPath);
    return;
  }

  // 스킵 다운로드 모드 (이미 다운로드된 파일 사용)
  const skipDownload = args.includes('--skip-download');

  try {
    ensureDir(TEMP_DIR);

    let csvFiles: string[] = [];

    if (!skipDownload) {
      // 1. ZIP 파일 다운로드
      await downloadFile(TOILET_CSV_URL, ZIP_PATH);

      // 2. ZIP 압축 해제
      csvFiles = extractZip(ZIP_PATH, EXTRACT_DIR);
    } else {
      // 기존 추출된 파일 사용
      if (fs.existsSync(EXTRACT_DIR)) {
        csvFiles = fs.readdirSync(EXTRACT_DIR)
          .filter((f) => f.endsWith('.csv'))
          .map((f) => path.join(EXTRACT_DIR, f));
      }
    }

    if (csvFiles.length === 0) {
      throw new Error('No CSV files found');
    }

    // 3. 각 CSV 파일 동기화
    for (const csvFile of csvFiles) {
      console.info(`\nProcessing: ${csvFile}`);
      await syncToilets(csvFile);
    }

    console.info('\n=== Sync process completed ===');
  } catch (error) {
    console.error('Sync failed:', error);
    process.exit(1);
  } finally {
    // 4. 임시 파일 정리 (옵션)
    if (!args.includes('--keep-files')) {
      cleanup();
    }
  }
}

// 스크립트 실행
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
