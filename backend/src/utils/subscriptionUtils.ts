// 청약 관련 유틸 함수

/**
 * houseDetailType 및 rentType 기반으로 publicRentType 값을 도출
 * @param houseDetailType - API로부터 받은 HOUSE_DTL_SECD_NM 필드값
 * @param rentType - API로부터 받은 RENT_SECD_NM 필드값
 * @returns 공공임대 세부 유형 또는 null
 *
 * 매핑 규칙:
 * - rentType === '임대주택'이 아니면 null 반환
 * - houseDetailType에 다음 키워드 포함 여부로 우선순위 매칭:
 *   1. '영구임대' → '영구임대'
 *   2. '국민임대' → '국민임대'
 *   3. '장기전세' → '장기전세'
 *   4. '공공임대' → '공공임대'
 *   5. '행복주택' → '행복주택'
 *   6. '역세권청' 또는 '역세권청년' → '역세권청년주택'
 *   7. '재개발임대' → '재개발임대'
 * - 위 매칭 없으면 '공공임대' (기본값)
 */
export function derivePublicRentType(
  houseDetailType: string | null | undefined,
  rentType: string | null | undefined
): string | null {
  // rentType이 '임대주택'이 아니면 null
  if (rentType !== '임대주택') {
    return null;
  }

  // houseDetailType이 없거나 비어있으면 기본값 '공공임대'
  if (!houseDetailType || houseDetailType.trim() === '') {
    return '공공임대';
  }

  const normalized = houseDetailType.trim();

  // 우선순위 매칭
  if (normalized.includes('영구임대')) return '영구임대';
  if (normalized.includes('국민임대')) return '국민임대';
  if (normalized.includes('장기전세')) return '장기전세';
  if (normalized.includes('공공임대')) return '공공임대';
  if (normalized.includes('행복주택')) return '행복주택';
  if (normalized.includes('역세권청')) return '역세권청년주택';
  if (normalized.includes('재개발임대')) return '재개발임대';

  // 위 매칭 없으면 기본값
  return '공공임대';
}
