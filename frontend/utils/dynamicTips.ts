import type { FacilityCategory, FacilityDetail, FacilityDetailsAll } from '~/types/facility'
import { CATEGORY_TIPS } from '~/utils/categoryDescriptions'

/**
 * 시설 데이터 기반 동적 이용 팁 생성
 * 시설의 실제 속성에 맞는 팁을 우선 배치하고, 정적 팁으로 보충하여 총 5개 반환
 */
export function generateDynamicTips(facility: FacilityDetail): string[] {
  const d = facility.details as FacilityDetailsAll
  const cat = facility.category

  const dynamic: string[] = []

  switch (cat) {
    case 'toilet':
      if (d.hasCCTV) dynamic.push('이 화장실에는 CCTV가 설치되어 있어 안전하게 이용할 수 있습니다.')
      if (d.hasEmergencyBell) dynamic.push('비상벨이 설치되어 있으니, 긴급 상황 시 이용하세요.')
      if (d.hasDisabledToilet) dynamic.push('장애인 화장실이 설치되어 있어 휠체어 이용자도 사용 가능합니다.')
      if (d.hasDiaperChangingTable) dynamic.push('기저귀 교환대가 비치되어 있어 영유아 동반 시 편리합니다.')
      if (d.openTime === '상시' || d.openTime === '24시간') dynamic.push('24시간 개방 화장실로, 야간에도 이용할 수 있습니다.')
      break

    case 'wifi':
      if (d.ssid) dynamic.push(`와이파이 설정에서 "${d.ssid}"를 선택하면 무료로 접속할 수 있습니다.`)
      if (d.installLocation) dynamic.push(`${d.installLocation} 주변에서 접속이 가능합니다.`)
      break

    case 'clothes':
      if (d.detailLocation) dynamic.push(`수거함 위치: ${d.detailLocation}`)
      if (d.managementAgency) dynamic.push(`관리기관(${d.managementAgency})에 문의하면 수거 요청이 가능합니다.`)
      break

    case 'parking':
      if (d.hasDisabledParking) dynamic.push('장애인 전용 주차 구역이 마련되어 있습니다.')
      if (d.feeType === '무료' || (d.baseFee !== undefined && d.baseFee !== null && d.baseFee === 0)) dynamic.push('무료 주차장으로, 별도의 주차 요금이 없습니다.')
      else if (d.baseFee && d.baseTime) dynamic.push(`기본 ${d.baseTime}분 ${d.baseFee.toLocaleString()}원으로 이용할 수 있습니다.`)
      if (d.monthlyFee) dynamic.push(`월정기 주차는 ${d.monthlyFee.toLocaleString()}원에 이용 가능합니다.`)
      if (d.paymentMethod) dynamic.push(`결제 방법: ${d.paymentMethod}`)
      break

    case 'aed':
      if (d.buildPlace) dynamic.push(`AED는 ${d.buildPlace}에 설치되어 있습니다. 위치를 미리 확인해 두세요.`)
      if (d.monSttTme && d.monEndTme) dynamic.push(`평일 ${d.monSttTme}~${d.monEndTme}에 접근 가능합니다.`)
      if (d.satSttTme && d.satEndTme) dynamic.push(`토요일에도 ${d.satSttTme}~${d.satEndTme}에 이용할 수 있습니다.`)
      break

    case 'library':
      if (d.closedDays) dynamic.push(`휴관일은 ${d.closedDays}이니 방문 전 확인하세요.`)
      if (d.loanableBooks && d.loanableDays) dynamic.push(`1인 최대 ${d.loanableBooks}권, ${d.loanableDays}일간 대출이 가능합니다.`)
      if (d.seatCount) dynamic.push(`열람석 ${d.seatCount}석을 이용할 수 있습니다.`)
      if (d.homepageUrl) dynamic.push('도서관 홈페이지에서 온라인 도서 검색과 전자책 대출이 가능합니다.')
      break

    case 'hospital':
      if (d.departments && d.departments.length > 0) {
        const depts = d.departments.slice(0, 4).map(dep => dep.dgsbjtCdNm).join(', ')
        dynamic.push(`${depts} 등의 진료과목에서 진료를 받을 수 있습니다.`)
      }
      if (d.parkQty && d.parkQty > 0) dynamic.push(`주차 ${d.parkQty}대 가능합니다.${d.parkEtc ? ` ${d.parkEtc}` : ''}`)
      if (d.lunchWeek) dynamic.push(`점심시간(${d.lunchWeek})에는 진료가 제한될 수 있으니 참고하세요.`)
      if (d.noTrmtSun === 'Y') dynamic.push('일요일은 휴진입니다.')
      break

    case 'pharmacy':
      if (d.dutyTel3) dynamic.push(`응급 상황 시 ${d.dutyTel3}으로 연락하실 수 있습니다.`)
      if (d.dutyTime7s && d.dutyTime7c) dynamic.push(`일요일에도 ${d.dutyTime7s}~${d.dutyTime7c}에 운영합니다.`)
      if (d.dutyTime8s && d.dutyTime8c) dynamic.push(`공휴일에도 ${d.dutyTime8s}~${d.dutyTime8c}에 운영합니다.`)
      break

    case 'trash':
      break

    case 'park':
      if (d.area) dynamic.push(`공원 면적은 약 ${d.area.toLocaleString()}㎡입니다.`)
      if (d.exerciseFacilities) dynamic.push(`운동시설: ${d.exerciseFacilities}`)
      if (d.playFacilities) dynamic.push(`놀이시설: ${d.playFacilities}`)
      if (d.managingOrg) dynamic.push(`관리기관: ${d.managingOrg}`)
      break

    case 'school':
      if (d.schoolLevel) dynamic.push(`${d.schoolLevel} 학교입니다.`)
      if (d.foundationType) dynamic.push(`설립 유형: ${d.foundationType}`)
      if (d.operationStatus) dynamic.push(`운영 현황: ${d.operationStatus}`)
      break

    case 'market':
      if (d.openingCycle) dynamic.push(`개장 주기: ${d.openingCycle}`)
      if (d.storeCount) dynamic.push(`총 ${d.storeCount.toLocaleString()}개 점포가 입점해 있습니다.`)
      if (d.hasPublicToilet) dynamic.push('공중화장실이 설치되어 있습니다.')
      if (d.hasParking) dynamic.push('주차 시설이 마련되어 있습니다.')
      break

    case 'childcare':
      if (d.crtypename) dynamic.push(`${d.crtypename}입니다.`)
      if (d.crcapat && d.crchcnt) dynamic.push(`정원 ${d.crcapat}명, 현원 ${d.crchcnt}명입니다.`)
      if (d.cctvinstlcnt) dynamic.push(`CCTV ${d.cctvinstlcnt}대가 설치되어 있습니다.`)
      if (d.crcargbname) dynamic.push('통학차량을 운행합니다.')
      break

    case 'ev-charger': {
      const charger = d.chargers?.[0]
      if (charger?.output) dynamic.push(`충전 출력: ${charger.output}kW`)
      if (charger?.chgerType) dynamic.push(`충전기 타입: ${charger.chgerType}`)
      if (d.parkingFree === 'Y') dynamic.push('충전 중 주차 요금이 무료입니다.')
      if (d.useTime) dynamic.push(`이용 가능 시간: ${d.useTime}`)
      dynamic.push('충전기 상태가 실시간으로 갱신되고 있습니다.')
      break
    }

    case 'sports':
      if (d.ftypeNm) dynamic.push(`시설 종류: ${d.ftypeNm}`)
      if (d.faciGbNm) dynamic.push(`시설 구분: ${d.faciGbNm}`)
      if (d.faciGfa) dynamic.push(`연면적: ${d.faciGfa}`)
      if (d.standCptPsnCnt) dynamic.push(`수용 인원: ${d.standCptPsnCnt.toLocaleString()}명`)
      break
  }

  // 동적 팁 최대 3개 + 정적 팁 보충하여 총 5개
  const dynamicSlice = dynamic.slice(0, 3)
  const staticTips = CATEGORY_TIPS[cat] ?? []
  const needed = 5 - dynamicSlice.length
  const staticSlice = staticTips.slice(0, needed)

  return [...dynamicSlice, ...staticSlice]
}
