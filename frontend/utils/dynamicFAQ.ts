import type { FacilityCategory, FacilityDetail, FacilityDetailsAll } from '~/types/facility'
import { CATEGORY_FAQ, type FAQItem } from '~/utils/categoryFAQ'

/**
 * 시설 데이터 기반 동적 FAQ 생성
 * 각 시설의 실제 데이터를 반영하여 페이지마다 고유한 FAQ를 생성하고,
 * 정적 FAQ를 보충하여 총 5개 FAQ를 반환한다.
 */
export function generateDynamicFAQ(facility: FacilityDetail): FAQItem[] {
  const d = facility.details as FacilityDetailsAll
  const cat = facility.category
  const name = facility.name

  const dynamic: FAQItem[] = []

  switch (cat) {
    case 'toilet':
      if (d.openTime) {
        const is24h = d.openTime === '상시' || d.openTime === '24시간'
        dynamic.push({
          question: `${name}은(는) 24시간 이용 가능한가요?`,
          answer: is24h
            ? `네, ${name}은(는) 상시 개방되어 있어 언제든 이용할 수 있습니다.`
            : `${name}의 개방시간은 ${d.openTime}입니다. 방문 전 시간을 확인해 주세요.`,
        })
      }
      if (d.hasDisabledToilet !== undefined) {
        dynamic.push({
          question: `${name}에 장애인 화장실이 있나요?`,
          answer: d.hasDisabledToilet
            ? `네, ${name}에는 장애인 화장실이 설치되어 있습니다. 넓은 공간과 손잡이, 비상벨 등의 편의시설을 갖추고 있습니다.`
            : `현재 ${name}에는 장애인 화장실이 설치되어 있지 않습니다. 인근의 장애인 화장실이 있는 공공화장실을 이용해 주세요.`,
        })
      }
      if (d.hasDiaperChangingTable !== undefined) {
        dynamic.push({
          question: `${name}에 기저귀 교환대가 있나요?`,
          answer: d.hasDiaperChangingTable
            ? `네, ${name}에는 기저귀 교환대가 설치되어 있습니다.${d.diaperChangingLocation ? ` 위치: ${d.diaperChangingLocation}` : ''}`
            : `현재 ${name}에는 기저귀 교환대가 설치되어 있지 않습니다.`,
        })
      }
      break

    case 'wifi':
      if (d.ssid) {
        dynamic.push({
          question: `${name}의 와이파이 SSID는 무엇인가요?`,
          answer: `${name}에서 사용 가능한 와이파이 SSID는 "${d.ssid}"입니다. 스마트폰 와이파이 설정에서 해당 이름을 선택하면 무료로 접속할 수 있습니다.`,
        })
      }
      if (d.installLocation) {
        dynamic.push({
          question: `${name} 와이파이는 어디서 접속할 수 있나요?`,
          answer: `${name} 와이파이는 ${d.installLocation}에 설치되어 있습니다.${d.installLocationDetail ? ` 상세 위치: ${d.installLocationDetail}` : ''} 설치 장소 주변에서 접속이 가능합니다.`,
        })
      }
      break

    case 'clothes':
      if (d.detailLocation) {
        dynamic.push({
          question: `${name} 의류수거함은 정확히 어디에 있나요?`,
          answer: `${name} 의류수거함은 ${d.detailLocation}에 위치해 있습니다. 깨끗하게 세탁한 의류를 봉투에 담아 넣어주세요.`,
        })
      }
      if (d.managementAgency || d.providerName) {
        const org = d.managementAgency || d.providerName
        dynamic.push({
          question: `${name} 의류수거함은 누가 관리하나요?`,
          answer: `${name} 의류수거함은 ${org}에서 관리·운영하고 있습니다. 수거함이 가득 찬 경우 해당 기관에 연락하면 수거를 요청할 수 있습니다.`,
        })
      }
      break

    case 'parking':
      if (d.baseFee !== undefined && d.baseFee !== null && d.baseTime) {
        let feeInfo = `기본 ${d.baseTime}분 ${d.baseFee.toLocaleString()}원`
        if (d.additionalFee && d.additionalTime) {
          feeInfo += `, 추가 ${d.additionalTime}분당 ${d.additionalFee.toLocaleString()}원`
        }
        if (d.dailyMaxFee) feeInfo += `, 1일 최대 ${d.dailyMaxFee.toLocaleString()}원`
        dynamic.push({
          question: `${name}의 주차 요금은 얼마인가요?`,
          answer: `${name}의 주차 요금은 ${feeInfo}입니다.${d.monthlyFee ? ` 월정기 주차 요금은 ${d.monthlyFee.toLocaleString()}원입니다.` : ''}`,
        })
      }
      if (d.capacity) {
        dynamic.push({
          question: `${name}에 주차 공간이 얼마나 되나요?`,
          answer: `${name}은(는) 총 ${d.capacity}면의 주차 공간을 보유하고 있습니다.${d.hasDisabledParking ? ' 장애인 전용 주차 구역도 마련되어 있습니다.' : ''}`,
        })
      }
      if (d.operatingDays) {
        dynamic.push({
          question: `${name}은(는) 매일 운영하나요?`,
          answer: `${name}의 운영 요일은 ${d.operatingDays}입니다.${d.operatingHours ? ` 운영 시간: ${d.operatingHours}` : ''}`,
        })
      }
      break

    case 'aed':
      if (d.buildPlace) {
        dynamic.push({
          question: `${name}의 AED는 정확히 어디에 있나요?`,
          answer: `${name}의 AED(자동심장충격기)는 ${d.buildPlace}에 설치되어 있습니다. 응급 상황 시 빠르게 접근할 수 있도록 위치를 미리 파악해 두세요.`,
        })
      }
      if (d.mfg || d.model) {
        const deviceInfo = [d.mfg, d.model].filter(Boolean).join(' ')
        dynamic.push({
          question: `${name}에 설치된 AED의 제조사와 모델은 무엇인가요?`,
          answer: `${name}에 설치된 AED는 ${deviceInfo}입니다. AED는 전원을 켜면 음성으로 사용 방법을 안내하므로 누구나 사용할 수 있습니다.`,
        })
      }
      {
        const is24h = d.sunSttTme && d.sunEndTme
        if (d.monSttTme && d.monEndTme) {
          dynamic.push({
            question: `${name}의 AED는 언제 이용 가능한가요?`,
            answer: is24h
              ? `${name}의 AED는 평일 ${d.monSttTme}~${d.monEndTme}에 이용 가능하며, 주말에도 접근할 수 있습니다. 설치 장소의 운영 시간에 따라 접근이 제한될 수 있으니 참고해 주세요.`
              : `${name}의 AED는 평일 ${d.monSttTme}~${d.monEndTme}에 이용 가능합니다. 설치 장소의 운영 시간에 따라 접근이 제한될 수 있습니다.`,
          })
        }
      }
      break

    case 'library':
      if (d.bookCount) {
        dynamic.push({
          question: `${name}에는 책이 얼마나 있나요?`,
          answer: `${name}은(는) 약 ${d.bookCount.toLocaleString()}권의 장서를 보유하고 있습니다.${d.loanableBooks ? ` 1인당 최대 ${d.loanableBooks}권까지 대출이 가능합니다.` : ''}${d.loanableDays ? ` 대출 기간은 ${d.loanableDays}일입니다.` : ''}`,
        })
      }
      if (d.closedDays) {
        dynamic.push({
          question: `${name}의 휴관일은 언제인가요?`,
          answer: `${name}의 휴관일은 ${d.closedDays}입니다. 방문 전 반드시 확인해 주세요.`,
        })
      }
      if (d.weekdayOpenTime && d.weekdayCloseTime) {
        let hours = `평일 ${d.weekdayOpenTime}~${d.weekdayCloseTime}`
        if (d.saturdayOpenTime && d.saturdayCloseTime) hours += `, 토요일 ${d.saturdayOpenTime}~${d.saturdayCloseTime}`
        if (d.holidayOpenTime && d.holidayCloseTime) hours += `, 공휴일 ${d.holidayOpenTime}~${d.holidayCloseTime}`
        dynamic.push({
          question: `${name}의 운영 시간은 어떻게 되나요?`,
          answer: `${name}의 운영 시간은 ${hours}입니다.`,
        })
      }
      if (d.seatCount) {
        dynamic.push({
          question: `${name}에 열람석은 몇 좌석인가요?`,
          answer: `${name}에는 총 ${d.seatCount}석의 열람석이 마련되어 있습니다. 시험 기간 등에는 좌석이 빠르게 찰 수 있으니 일찍 방문하시는 것을 권장합니다.`,
        })
      }
      break

    case 'hospital':
      if (d.departments && d.departments.length > 0) {
        const deptNames = d.departments.slice(0, 6).map(dep => dep.dgsbjtCdNm).join(', ')
        const more = d.departments.length > 6 ? ` 외 ${d.departments.length - 6}개` : ''
        dynamic.push({
          question: `${name}에서 어떤 진료과목을 진료하나요?`,
          answer: `${name}에서는 ${deptNames}${more} 진료과목에서 진료를 받을 수 있습니다.`,
        })
      }
      if (d.clCdNm) {
        dynamic.push({
          question: `${name}은(는) 어떤 종류의 의료기관인가요?`,
          answer: `${name}은(는) ${d.clCdNm}입니다.${d.drTotCnt ? ` 총 ${d.drTotCnt}명의 의료진이 근무하고 있습니다.` : ''}`,
        })
      }
      if (d.trmtMonStart && d.trmtMonEnd) {
        let hours = `평일 ${d.trmtMonStart}~${d.trmtMonEnd}`
        if (d.trmtSatStart && d.trmtSatEnd) hours += `, 토요일 ${d.trmtSatStart}~${d.trmtSatEnd}`
        const sunInfo = d.noTrmtSun === 'Y' ? '일요일 휴진' : (d.trmtSunStart && d.trmtSunEnd ? `일요일 ${d.trmtSunStart}~${d.trmtSunEnd}` : '')
        if (sunInfo) hours += `, ${sunInfo}`
        dynamic.push({
          question: `${name}의 진료 시간은 어떻게 되나요?`,
          answer: `${name}의 진료 시간은 ${hours}입니다.${d.lunchWeek ? ` 점심시간: ${d.lunchWeek}` : ''} 방문 전 전화로 확인하시는 것을 권장합니다.`,
        })
      }
      if (d.parkQty !== undefined && d.parkQty !== null) {
        dynamic.push({
          question: `${name}에 주차가 가능한가요?`,
          answer: d.parkQty > 0
            ? `네, ${name}에는 ${d.parkQty}대 규모의 주차 공간이 있습니다.${d.parkEtc ? ` ${d.parkEtc}` : ''}`
            : `${name}에는 별도의 주차 공간이 없습니다. 대중교통 이용을 권장합니다.`,
        })
      }
      break

    case 'pharmacy':
      if (d.dutyTime1s && d.dutyTime1c) {
        let hours = `월요일 ${d.dutyTime1s}~${d.dutyTime1c}`
        if (d.dutyTime6s && d.dutyTime6c) hours += `, 토요일 ${d.dutyTime6s}~${d.dutyTime6c}`
        if (d.dutyTime7s && d.dutyTime7c) hours += `, 일요일 ${d.dutyTime7s}~${d.dutyTime7c}`
        dynamic.push({
          question: `${name}의 영업 시간은 어떻게 되나요?`,
          answer: `${name}의 영업 시간은 ${hours}입니다. 정확한 운영 시간은 방문 전 전화로 확인하시는 것을 권장합니다.`,
        })
      }
      if (d.dutyTel3) {
        dynamic.push({
          question: `${name}의 응급 연락처가 있나요?`,
          answer: `네, ${name}의 응급 전화번호는 ${d.dutyTel3}입니다. 야간이나 응급 상황 시 이 번호로 연락하실 수 있습니다.`,
        })
      }
      break

    case 'trash':
      break

    case 'park':
      if (d.area) {
        dynamic.push({
          question: `${name}의 면적은 얼마나 되나요?`,
          answer: `${name}의 면적은 약 ${d.area.toLocaleString()}㎡입니다.`,
        })
      }
      if (d.managingOrg) {
        dynamic.push({
          question: `${name}은(는) 어디서 관리하나요?`,
          answer: `${name}은(는) ${d.managingOrg}에서 관리하고 있습니다. 문의사항은 관리기관으로 연락하세요.`,
        })
      }
      break

    case 'school':
      if (d.schoolLevel) {
        dynamic.push({
          question: `${name}은(는) 어떤 학교인가요?`,
          answer: `${name}은(는) ${d.schoolLevel}입니다.${d.foundationType ? ` 설립 유형은 ${d.foundationType}입니다.` : ''}`,
        })
      }
      if (d.sidoEduName || d.localEduName) {
        const eduOrg = d.localEduName || d.sidoEduName
        dynamic.push({
          question: `${name}의 관할 교육청은 어디인가요?`,
          answer: `${name}의 관할 교육청은 ${eduOrg}입니다. 입학 및 전학 관련 문의는 해당 교육지원청으로 연락하세요.`,
        })
      }
      break

    case 'market':
      if (d.openingCycle) {
        dynamic.push({
          question: `${name}은(는) 언제 열리나요?`,
          answer: `${name}의 개장 주기는 ${d.openingCycle}입니다. 방문 전 일정을 확인하세요.`,
        })
      }
      if (d.storeCount) {
        dynamic.push({
          question: `${name}에는 몇 개의 점포가 있나요?`,
          answer: `${name}에는 총 ${d.storeCount.toLocaleString()}개의 점포가 입점해 있습니다.`,
        })
      }
      break

    case 'childcare':
      if (d.crtypename) {
        dynamic.push({
          question: `${name}은(는) 어떤 유형의 어린이집인가요?`,
          answer: `${name}은(는) ${d.crtypename}입니다.${d.crstatusname ? ` 현재 운영 상태는 ${d.crstatusname}입니다.` : ''}`,
        })
      }
      if (d.crcapat !== undefined && d.crchcnt !== undefined) {
        dynamic.push({
          question: `${name}의 정원과 현원은 어떻게 되나요?`,
          answer: `${name}의 정원은 ${d.crcapat}명이며, 현재 재원 중인 아동 수(현원)는 ${d.crchcnt}명입니다. 입소 여부는 해당 어린이집에 직접 문의하세요.`,
        })
      }
      break

    case 'ev-charger': {
      const charger = d.chargers?.[0]
      if (charger?.output && charger?.chgerType) {
        dynamic.push({
          question: `${name}의 충전기 종류와 출력은 어떻게 되나요?`,
          answer: `${name}의 충전기 타입은 ${charger.chgerType}이며, 출력은 ${charger.output}kW입니다. 차량 사양에 맞는 충전기를 확인하고 이용하세요.`,
        })
      }
      if (d.parkingFree !== undefined) {
        dynamic.push({
          question: `${name}에서 충전 중 주차 요금이 무료인가요?`,
          answer: d.parkingFree === 'Y'
            ? `네, ${name}은(는) 충전 중 주차 요금이 무료입니다. 단, 충전 완료 후 장시간 점유 시 주차 요금이 부과될 수 있으니 안내문을 확인하세요.`
            : `${name}은(는) 충전 중에도 주차 요금이 부과될 수 있습니다. 방문 전 요금 안내를 확인하세요.`,
        })
      }
      break
    }
    case 'sports':
      if (d.ftypeNm) {
        dynamic.push({
          question: `${name}은(는) 어떤 종류의 체육시설인가요?`,
          answer: `${name}은(는) ${d.ftypeNm}입니다.${d.faciGbNm ? ` 시설 구분은 ${d.faciGbNm}입니다.` : ''}`,
        })
      }
      if (d.standCptPsnCnt) {
        dynamic.push({
          question: `${name}의 수용 인원은 얼마나 되나요?`,
          answer: `${name}의 수용 가능 인원은 ${d.standCptPsnCnt.toLocaleString()}명입니다.${d.faciGfa ? ` 연면적은 ${d.faciGfa}입니다.` : ''}`,
        })
      }
      break
  }

  // 동적 FAQ 최대 3개 + 정적 FAQ 보충하여 총 5개
  const dynamicSlice = dynamic.slice(0, 3)
  const staticFaqs = CATEGORY_FAQ[cat] ?? []
  const needed = 5 - dynamicSlice.length
  const staticSlice = staticFaqs.slice(0, needed)

  return [...dynamicSlice, ...staticSlice]
}
