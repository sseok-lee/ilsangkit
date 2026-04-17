import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { installRuntimeGuard } from '../../src/scripts/_runtimeGuard.js';

type Signal = 'SIGTERM' | 'SIGINT' | 'SIGHUP';
const SIGNALS: Signal[] = ['SIGTERM', 'SIGINT', 'SIGHUP'];

describe('installRuntimeGuard', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exitSpy: any;
  let savedListeners: Record<Signal, NodeJS.SignalsListener[]>;
  let mockPrisma: { $disconnect: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    mockPrisma = { $disconnect: vi.fn().mockResolvedValue(undefined) };
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => undefined as never));

    savedListeners = {
      SIGTERM: process.listeners('SIGTERM'),
      SIGINT: process.listeners('SIGINT'),
      SIGHUP: process.listeners('SIGHUP'),
    };
    for (const sig of SIGNALS) process.removeAllListeners(sig);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    exitSpy.mockRestore();
    for (const sig of SIGNALS) {
      process.removeAllListeners(sig);
      for (const listener of savedListeners[sig]) {
        process.on(sig, listener);
      }
    }
  });

  it('watchdog 타임아웃에 도달하면 prisma disconnect 후 exit(124)', async () => {
    installRuntimeGuard({ maxMinutes: 5, name: 'test', prisma: mockPrisma });

    expect(exitSpy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(5 * 60_000 + 100);

    expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(124);
  });

  it('SIGTERM 수신 시 prisma disconnect 후 exit(143)', async () => {
    installRuntimeGuard({ maxMinutes: 999, name: 'test', prisma: mockPrisma });

    process.emit('SIGTERM');
    await vi.runAllTicks();
    await Promise.resolve();

    expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(143);
  });

  it('SIGINT 수신 시 exit(130)', async () => {
    installRuntimeGuard({ maxMinutes: 999, name: 'test', prisma: mockPrisma });

    process.emit('SIGINT');
    await vi.runAllTicks();
    await Promise.resolve();

    expect(exitSpy).toHaveBeenCalledWith(130);
  });

  it('SIGHUP 수신 시 exit(129)', async () => {
    installRuntimeGuard({ maxMinutes: 999, name: 'test', prisma: mockPrisma });

    process.emit('SIGHUP');
    await vi.runAllTicks();
    await Promise.resolve();

    expect(exitSpy).toHaveBeenCalledWith(129);
  });

  it('prisma 없이도 exit은 호출됨', async () => {
    installRuntimeGuard({ maxMinutes: 999, name: 'test' });

    process.emit('SIGTERM');
    await vi.runAllTicks();
    await Promise.resolve();

    expect(exitSpy).toHaveBeenCalledWith(143);
  });

  it('prisma.$disconnect 실패해도 exit은 호출됨', async () => {
    mockPrisma.$disconnect.mockRejectedValueOnce(new Error('disconnect failed'));
    installRuntimeGuard({ maxMinutes: 999, name: 'test', prisma: mockPrisma });

    process.emit('SIGTERM');
    await vi.runAllTicks();
    await Promise.resolve();
    await Promise.resolve();

    expect(exitSpy).toHaveBeenCalledWith(143);
  });
});
