// 기사 생성 단일-플라이트 락 (고정 id='singleton'). 크래시로 wedge되지 않도록 stale-timeout 재확보.
import prisma from './prisma.js';

const ID = 'singleton';
const STALE_MS = 10 * 60 * 1000; // 10분 — 이 시간이 지나면 running=true라도 재확보 허용

// acquire 전 singleton 행 보장 (없으면 생성, 있으면 그대로 둠 — running 덮어쓰지 않음)
async function ensureRow(): Promise<void> {
  await prisma.articleGenerationLock.upsert({
    where: { id: ID },
    create: { id: ID, running: false, startedAt: new Date() },
    update: {},
  });
}

// 락 확보 시도. running=false거나 startedAt이 stale-threshold보다 오래됐으면(크래시로 방치된 락)
// 확보 가능. updateMany + count===1 가드로 동시 요청 중 단 하나만 성공.
export async function acquireGenerationLock(): Promise<boolean> {
  await ensureRow();
  const staleThreshold = new Date(Date.now() - STALE_MS);
  const result = await prisma.articleGenerationLock.updateMany({
    where: {
      id: ID,
      OR: [{ running: false }, { startedAt: { lt: staleThreshold } }],
    },
    data: { running: true, startedAt: new Date() },
  });
  return result.count === 1;
}

// 락 해제 — child 프로세스 종료 시 best-effort로 호출.
export async function releaseGenerationLock(): Promise<void> {
  await prisma.articleGenerationLock.updateMany({
    where: { id: ID },
    data: { running: false },
  });
}
