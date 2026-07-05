import { describe, it, expect, vi, beforeEach } from 'vitest';

// Vitest v4는 vi.mock 팩토리 내부에서 참조하는 top-level 변수를 vi.hoisted로 감싸야 한다
// (일반 const는 vi.mock 호이스팅보다 뒤에 초기화되어 "Cannot access before initialization" 발생).
// 기존 __tests__/routes/adminArticles.test.ts와 동일한 패턴.
const { guide, unlink } = vi.hoisted(() => ({
  guide: {
    findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn(),
  },
  unlink: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/lib/prisma.js', () => ({ default: { guide } }));
vi.mock('fs/promises', () => ({ unlink }));

import { publishGuide, unpublishGuide, rejectGuide } from '../../src/services/adminGuideService.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('publishGuide', () => {
  it('최초 발행 시 publishedAt 세팅', async () => {
    guide.findUnique.mockResolvedValue({ id: 'g1', publishedAt: null, title: 't', summary: 's', content: 'c', thumbnailUrl: '/api/images/guides/x.webp' });
    guide.update.mockResolvedValue({ id: 'g1' });
    await publishGuide('g1');
    const arg = guide.update.mock.calls[0][0];
    expect(arg.data.published).toBe(true);
    expect(arg.data.publishedAt).toBeInstanceOf(Date);
  });
  it('이미 publishedAt 있으면 유지', async () => {
    const prev = new Date('2026-01-01T00:00:00Z');
    guide.findUnique.mockResolvedValue({ id: 'g1', publishedAt: prev, title: 't', summary: 's', content: 'c', thumbnailUrl: '/x.webp' });
    guide.update.mockResolvedValue({ id: 'g1' });
    await publishGuide('g1');
    expect(guide.update.mock.calls[0][0].data.publishedAt).toEqual(prev);
  });
  it('필수 필드 비면 ValidationError', async () => {
    guide.findUnique.mockResolvedValue({ id: 'g1', publishedAt: null, title: '', summary: 's', content: 'c', thumbnailUrl: '/x.webp' });
    await expect(publishGuide('g1')).rejects.toThrow();
  });
});

describe('unpublishGuide', () => {
  it('published=false + publishedAt=null', async () => {
    guide.findUnique.mockResolvedValue({ id: 'g1' });
    guide.update.mockResolvedValue({ id: 'g1' });
    await unpublishGuide('g1');
    expect(guide.update.mock.calls[0][0].data).toEqual({ published: false, publishedAt: null });
  });
});

describe('rejectGuide', () => {
  it('가이드 디렉터리 안 파일만 unlink 후 삭제', async () => {
    guide.findUnique.mockResolvedValue({ id: 'g1', thumbnailUrl: '/api/images/guides/x.webp' });
    guide.delete.mockResolvedValue({ id: 'g1' });
    await rejectGuide('g1');
    expect(unlink).toHaveBeenCalledTimes(1);
    expect(guide.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
  });
  it('basename이 경로를 중화하므로 디렉터리 안 파일로 unlink', async () => {
    guide.findUnique.mockResolvedValue({ id: 'g1', thumbnailUrl: '/api/images/guides/../../etc/passwd' });
    guide.delete.mockResolvedValue({ id: 'g1' });
    await rejectGuide('g1');
    // basename('.../../etc/passwd')='passwd' → GUIDES_IMAGE_DIR 안으로 정규화되어 unlink 1회, 탈출 아님
    expect(unlink).toHaveBeenCalledTimes(1);
    expect(guide.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
  });
  it('디렉터리 탈출 시도(thumbnailUrl이 ..로 끝남)는 unlink 스킵하되 삭제는 진행', async () => {
    guide.findUnique.mockResolvedValue({ id: 'g1', thumbnailUrl: '/api/images/guides/..' });
    guide.delete.mockResolvedValue({ id: 'g1' });
    await rejectGuide('g1');
    // basename('/api/images/guides/..')='..' → resolve 결과가 GUIDES_IMAGE_DIR의 부모 디렉터리가 되어 unlink 스킵
    expect(unlink).not.toHaveBeenCalled();
    expect(guide.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
  });
});
