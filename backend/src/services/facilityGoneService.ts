import prisma from '../lib/prisma.js';

/**
 * 영구 제거된 시설 상세 URL 조회.
 *
 * 원천 데이터에서 사라진 시설(폐업·전환·키 재발급)의 행을 삭제한 뒤에도 그 URL 이
 * 404 대신 410 을 내도록 한다. 404 로도 결국 de-index 되지만 410 이 더 빠르고
 * 의미상 정확하다.
 *
 * 조회는 시설을 못 찾은 경로에서만 호출된다 — 정상 트래픽에는 쿼리가 추가되지 않는다.
 */
export async function isFacilityGone(id: string): Promise<boolean> {
  if (!id) return false;
  try {
    const row = await prisma.facilityGone.findUnique({
      where: { id },
      select: { id: true },
    });
    return row !== null;
  } catch (error) {
    // fail-open: 조회 실패는 404(기존 동작)로 떨어뜨린다.
    // 여기서 throw 하면 "없는 시설" 요청이 404 가 아니라 500 이 되고, 크롤러는 5xx 를
    // 일시 장애로 읽어 재시도하므로 de-index 가 오히려 늦어진다. 테이블 부재(마이그레이션
    // 이전)·풀 고갈 같은 일시 사유로 정상 404 경로가 깨지는 것도 막는다.
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[FacilityGone] 조회 실패 (id=${id}) — 404 로 처리: ${msg}`);
    return false;
  }
}
