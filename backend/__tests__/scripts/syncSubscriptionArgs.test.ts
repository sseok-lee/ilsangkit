import { describe, it, expect } from 'vitest';
import { resolveSources } from '../../src/scripts/syncSubscription.js';

const NODE = '/Users/x/.nvm/versions/node/v20.19.5/bin/node';
const SCRIPT = '/proj/backend/src/scripts/syncSubscription.ts';

describe('resolveSources', () => {
  it('인자 없으면 모든 소스(ALL) 반환', () => {
    expect(resolveSources([NODE, SCRIPT])).toEqual(
      ['APT', 'OFFITEL', 'REMAINING', 'PRIVATE_RENT', 'OPTIONAL']
    );
  });
  it('--source=APT 는 [APT]', () => {
    expect(resolveSources([NODE, SCRIPT, '--source=APT'])).toEqual(['APT']);
  });
  it('--source APT (공백형) 도 [APT]', () => {
    expect(resolveSources([NODE, SCRIPT, '--source', 'APT'])).toEqual(['APT']);
  });
  it('소문자도 대문자로 정규화', () => {
    expect(resolveSources([NODE, SCRIPT, '--source=offitel'])).toEqual(['OFFITEL']);
  });
  it('ALL 명시도 전체', () => {
    expect(resolveSources([NODE, SCRIPT, '--source=ALL']).length).toBe(5);
  });
});
