/** 전 카테고리 통합 전화번호 우선순위 해석 (phoneNumber > phone > clerkTel > crtelno > busiCall). */
export function resolveFacilityPhone(
  details: Record<string, unknown> | null | undefined,
): string | null {
  if (!details) return null
  const d = details
  return (
    (d.phoneNumber as string) ||
    (d.phone as string) ||
    (d.clerkTel as string) ||
    (d.crtelno as string) ||
    (d.busiCall as string) ||
    null
  )
}
