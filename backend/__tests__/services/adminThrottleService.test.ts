import { describe, it, expect, vi, beforeEach } from 'vitest';
const { mockUpsert, mockFindUnique, mockUpdate } = vi.hoisted(() => ({
  mockUpsert: vi.fn(), mockFindUnique: vi.fn(), mockUpdate: vi.fn(),
}));
vi.mock('../../src/lib/prisma.js', () => ({
  default: { adminLoginThrottle: { upsert: mockUpsert, findUnique: mockFindUnique, update: mockUpdate } },
}));
import { recordLoginFailure, clearLoginFailures, isLockedOut, MAX_ATTEMPTS } from '../../src/services/adminThrottleService.js';

beforeEach(() => { mockUpsert.mockReset(); mockFindUnique.mockReset(); mockUpdate.mockReset(); });

describe('adminThrottleService', () => {
  it('isLockedOut: lockedUntil 미래면 true', async () => {
    mockFindUnique.mockResolvedValue({ id: 'admin', failedAttempts: 5, lockedUntil: new Date(Date.now() + 60000) });
    expect(await isLockedOut()).toBe(true);
  });
  it('isLockedOut: lockedUntil 과거면 false', async () => {
    mockFindUnique.mockResolvedValue({ id: 'admin', failedAttempts: 5, lockedUntil: new Date(Date.now() - 1000) });
    expect(await isLockedOut()).toBe(false);
  });
  it('isLockedOut: 행 없으면 false', async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await isLockedOut()).toBe(false);
  });
  it('recordLoginFailure: MAX 도달 시 lockedUntil 설정', async () => {
    mockUpsert.mockResolvedValue({ id: 'admin', failedAttempts: MAX_ATTEMPTS, lockedUntil: null });
    mockUpdate.mockResolvedValue({});
    await recordLoginFailure();
    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(mockUpdate).toHaveBeenCalledOnce(); // 잠금 설정
    expect(mockUpdate.mock.calls[0][0].data.lockedUntil).toBeInstanceOf(Date);
  });
  it('recordLoginFailure: MAX 미만이면 잠금 없음', async () => {
    mockUpsert.mockResolvedValue({ id: 'admin', failedAttempts: 2, lockedUntil: null });
    await recordLoginFailure();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
  it('clearLoginFailures: 카운터·잠금 리셋', async () => {
    mockUpsert.mockResolvedValue({});
    await clearLoginFailures();
    expect(mockUpsert.mock.calls[0][0].update).toEqual({ failedAttempts: 0, lockedUntil: null });
  });
});
