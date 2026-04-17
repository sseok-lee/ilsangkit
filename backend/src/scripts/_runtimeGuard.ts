export interface DisconnectableClient {
  $disconnect(): Promise<void>;
}

export interface RuntimeGuardOptions {
  maxMinutes: number;
  name: string;
  /**
   * 호출자가 보유한 Prisma 클라이언트를 주입. 생략하면 종료 시 disconnect만
   * 스킵하고 process.exit으로 바로 넘어간다 (OS가 커넥션 회수).
   * 의존성을 주입 형태로 바꾸면 테스트에서 모듈 모킹 없이도 동작 검증 가능.
   */
  prisma?: DisconnectableClient;
}

/**
 * Sync/backfill 스크립트용 런타임 가드.
 *
 * SIGTERM/SIGINT/SIGHUP 수신 또는 `maxMinutes` 초과 시 prisma 커넥션을 해제하고
 * 프로세스를 강제 종료한다. 2026-04-17 MySQL 좀비 사고 재발 방지용.
 */
export function installRuntimeGuard(opts: RuntimeGuardOptions): void {
  const disconnect = async (sig: string, code: number): Promise<void> => {
    console.warn(`[${opts.name}] ${sig} 수신 → prisma disconnect 후 종료 (exit ${code})`);
    if (opts.prisma) {
      try {
        await opts.prisma.$disconnect();
      } catch {
        // ignore disconnect errors during forced shutdown
      }
    }
    process.exit(code);
  };

  process.on('SIGTERM', () => { void disconnect('SIGTERM', 143); });
  process.on('SIGINT', () => { void disconnect('SIGINT', 130); });
  process.on('SIGHUP', () => { void disconnect('SIGHUP', 129); });

  const timer = setTimeout(() => {
    console.error(`[${opts.name}] watchdog: ${opts.maxMinutes}분 초과, 강제 종료`);
    void disconnect('WATCHDOG', 124);
  }, opts.maxMinutes * 60_000);
  timer.unref();
}
