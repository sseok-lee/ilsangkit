/**
 * 쓰레기 배출 HowTo 스키마용 단계 상수
 */
export interface HowToStep {
  name: string
  text: string
}

export const WASTE_HOWTO_STEPS: HowToStep[] = [
  {
    name: '분리수거 기준 확인',
    text: '지역별 분리수거 기준(재활용 가능 항목)을 확인합니다.',
  },
  {
    name: '쓰레기봉투 구매',
    text: '해당 지역 규격 종량제 봉투를 마트 또는 편의점에서 구매합니다.',
  },
  {
    name: '배출 요일/시간 확인',
    text: '지역별 쓰레기 배출 요일과 허용 시간대를 확인합니다.',
  },
  {
    name: '쓰레기 분류 및 포장',
    text: '일반쓰레기, 재활용품, 음식물쓰레기를 각각 분류하여 포장합니다.',
  },
  {
    name: '지정 장소에 배출',
    text: '배출 허용 시간 내에 지정된 배출 장소에 쓰레기를 내놓습니다.',
  },
]

export const WASTE_HOWTO_NAME = '쓰레기 올바르게 배출하는 방법'
export const WASTE_HOWTO_DESCRIPTION = '종량제 봉투 사용부터 분리수거, 지정 장소 배출까지 쓰레기 배출 전 과정을 안내합니다.'
export const WASTE_HOWTO_TOTAL_TIME = 'PT15M'
