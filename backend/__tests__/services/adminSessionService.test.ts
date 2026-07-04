import { describe, it, expect, vi, beforeEach } from 'vitest';
const { mockCreate, mockFindUnique, mockDelete, mockDeleteMany } = vi.hoisted(() => ({
  mockCreate: vi.fn(), mockFindUnique: vi.fn(), mockDelete: vi.fn(), mockDeleteMany: vi.fn(),
}));
vi.mock('../../src/lib/prisma.js', () => ({
  default: { adminSession: { create: mockCreate, findUnique: mockFindUnique, delete: mockDelete, deleteMany: mockDeleteMany } },
}));
import { createSession, verifySession, revokeSession, hashToken } from '../../src/services/adminSessionService.js';

beforeEach(() => { mockCreate.mockReset(); mockFindUnique.mockReset(); mockDelete.mockReset(); mockDeleteMany.mockReset(); });

describe('adminSessionService', () => {
  it('createSession: raw 토큰 반환하되 DB엔 sha256(token)을 id로 저장', async () => {
    mockCreate.mockResolvedValue({});
    const { token, expiresAt } = await createSession();
    expect(token).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(expiresAt).toBeInstanceOf(Date);
    const arg = mockCreate.mock.calls[0][0].data;
    expect(arg.id).toBe(hashToken(token));
    expect(arg.id).not.toBe(token); // raw 토큰이 저장되지 않음
  });

  it('verifySession: 미만료 세션이면 true', async () => {
    mockFindUnique.mockResolvedValue({ id: 'x', expiresAt: new Date(Date.now() + 60000) });
    expect(await verifySession('tok')).toBe(true);
    expect(mockFindUnique.mock.calls[0][0].where.id).toBe(hashToken('tok'));
  });

  it('verifySession: 만료 세션이면 false + 행 삭제', async () => {
    mockFindUnique.mockResolvedValue({ id: 'x', expiresAt: new Date(Date.now() - 1000) });
    mockDelete.mockResolvedValue({});
    expect(await verifySession('tok')).toBe(false);
    expect(mockDelete).toHaveBeenCalledOnce();
  });

  it('verifySession: 없는 세션이면 false', async () => {
    mockFindUnique.mockResolvedValue(null);
    expect(await verifySession('tok')).toBe(false);
  });

  it('revokeSession: 해시로 삭제(없어도 throw 안 함)', async () => {
    mockDelete.mockRejectedValue(new Error('not found'));
    await expect(revokeSession('tok')).resolves.toBeUndefined();
  });
});
