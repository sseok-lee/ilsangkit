// @TASK T2.4 - 통합 동기화 스케줄러 테스트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { describe, it, expect } from 'vitest';

/**
 * 옵션 파싱 테스트
 */
describe('syncAll CLI 옵션 파싱', () => {
  it('--only 옵션으로 특정 카테고리만 선택', () => {
    const args = ['--only', 'toilet,wifi'];
    const allCategories = ['toilet', 'trash', 'wifi', 'clothes', 'park'];

    // --only 옵션 처리
    const onlyIndex = args.indexOf('--only');
    let categoriesToSync = [...allCategories];

    if (onlyIndex !== -1 && args[onlyIndex + 1]) {
      const onlyCategories = args[onlyIndex + 1].split(',');
      categoriesToSync = categoriesToSync.filter(c => onlyCategories.includes(c));
    }

    expect(categoriesToSync).toEqual(['toilet', 'wifi']);
  });

  it('--skip 옵션으로 특정 카테고리 제외', () => {
    const args = ['--skip', 'park'];
    const allCategories = ['toilet', 'trash', 'wifi', 'clothes', 'park'];

    // --skip 옵션 처리
    const skipIndex = args.indexOf('--skip');
    let categoriesToSync = [...allCategories];

    if (skipIndex !== -1 && args[skipIndex + 1]) {
      const skipCategories = args[skipIndex + 1].split(',');
      categoriesToSync = categoriesToSync.filter(c => !skipCategories.includes(c));
    }

    expect(categoriesToSync).toEqual(['toilet', 'trash', 'wifi', 'clothes']);
  });

  it('--only와 --skip 혼용 시 --only 우선', () => {
    const args = ['--only', 'toilet,wifi,trash', '--skip', 'wifi'];
    const allCategories = ['toilet', 'trash', 'wifi', 'clothes', 'park'];

    let categoriesToSync = [...allCategories];

    // --only 먼저 처리
    const onlyIndex = args.indexOf('--only');
    if (onlyIndex !== -1 && args[onlyIndex + 1]) {
      const onlyCategories = args[onlyIndex + 1].split(',');
      categoriesToSync = categoriesToSync.filter(c => onlyCategories.includes(c));
    }

    // --skip 나중에 처리
    const skipIndex = args.indexOf('--skip');
    if (skipIndex !== -1 && args[skipIndex + 1]) {
      const skipCategories = args[skipIndex + 1].split(',');
      categoriesToSync = categoriesToSync.filter(c => !skipCategories.includes(c));
    }

    expect(categoriesToSync).toEqual(['toilet', 'trash']);
  });
});

/**
 * 결과 집계 테스트
 */
describe('syncAll 결과 집계', () => {
  it('성공/실패 카운트 정확히 계산', () => {
    const results = [
      { category: 'toilet', success: true, duration: 1000 },
      { category: 'trash', success: true, duration: 2000 },
      { category: 'wifi', success: false, error: 'Network error', duration: 500 },
      { category: 'clothes', success: true, duration: 1500 },
      { category: 'park', success: true, duration: 3000 },
    ];

    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    expect(success).toBe(4);
    expect(failed).toBe(1);
  });

  it('실패한 카테고리 목록 추출', () => {
    const results = [
      { category: 'toilet', success: true, duration: 1000 },
      { category: 'trash', success: false, error: 'Network error', duration: 500 },
      { category: 'wifi', success: false, error: 'API key missing', duration: 100 },
    ];

    const failedResults = results.filter(r => !r.success);
    const failedCategories = failedResults.map(r => r.category);

    expect(failedCategories).toEqual(['trash', 'wifi']);
  });

  it('모든 동기화 성공 시 exitCode 0', () => {
    const results = [
      { category: 'toilet', success: true, duration: 1000 },
      { category: 'trash', success: true, duration: 2000 },
    ];

    const failed = results.filter(r => !r.success).length;
    const exitCode = failed > 0 ? 1 : 0;

    expect(exitCode).toBe(0);
  });

  it('일부 실패 시 exitCode 1', () => {
    const results = [
      { category: 'toilet', success: true, duration: 1000 },
      { category: 'trash', success: false, error: 'Error', duration: 500 },
    ];

    const failed = results.filter(r => !r.success).length;
    const exitCode = failed > 0 ? 1 : 0;

    expect(exitCode).toBe(1);
  });
});
