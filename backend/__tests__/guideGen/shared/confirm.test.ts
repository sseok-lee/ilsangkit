import { describe, it, expect } from 'vitest';
import { confirmDestructive } from '../../../src/guideGen/shared/confirm.js';

describe('confirmDestructive', () => {
  it('returns true when yes flag is set', async () => {
    expect(await confirmDestructive({ yes: true, action: 'publish' })).toBe(true);
  });

  it('returns false when yes flag is not set and stdin is not a TTY (test env)', async () => {
    // In test env, process.stdin.isTTY is undefined → no prompt possible → reject.
    expect(await confirmDestructive({ yes: false, action: 'publish' })).toBe(false);
  });
});
