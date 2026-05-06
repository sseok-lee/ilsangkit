// 공공임대 rentalType별 정적 콘텐츠 (가이드/자격/절차/FAQ)

export interface RentalTypeGuide {
  summary: string
  features: string[]
  targetAudience: string
}

export interface EligibilityRequirement {
  label: string
  detail: string
}

export interface ApplyStep {
  step: number
  title: string
  description: string
}

export interface FaqItem {
  question: string
  answer: string
}

export const RENTAL_TYPE_GUIDES: Record<string, RentalTypeGuide> = {
  매입임대: {
    summary:
      '매입임대는 한국토지주택공사(LH)·서울주택도시공사(SH) 등 공공기관이 기존에 지어진 다가구·다세대·아파트 주택을 매입하여 무주택 저소득층에 시중 시세의 30~50% 수준으로 임대하는 공공임대 제도입니다. 도시 내 우수 입지의 기존 주택을 활용하므로 직장·학교 접근성이 좋다는 장점이 있습니다.',
    features: [
      '시중 시세의 30~50% 수준의 저렴한 임대료',
      '청약통장 없이도 자격 요건만 충족하면 신청 가능',
      '최초 임대 기간 2년, 재계약 시 최장 20년까지 거주 가능',
      '도심 내 다세대·다가구 주택 위주로 직장·학교 접근성 우수',
    ],
    targetAudience:
      '도시근로자 가구 월평균 소득 70% 이하의 무주택 세대주, 신혼부부, 한부모가족, 청년·대학생 등',
  },
  전세임대: {
    summary:
      '전세임대는 입주 희망자가 직접 살고 싶은 주택을 찾으면 LH·SH 등 공공기관이 집주인과 전세계약을 체결한 후 저렴하게 재임대하는 제도입니다. 매입임대와 달리 입주자가 원하는 위치·구조의 주택을 선택할 수 있다는 점이 가장 큰 특징입니다.',
    features: [
      '입주자가 원하는 주택을 직접 선택 가능',
      '공공기관이 전세보증금의 95~100%를 지원 (입주자 부담은 5% 이하)',
      '월세 부담 없이 저렴한 이자만 납부',
      '계약 기간 2년, 재계약 시 최장 20년까지 거주 가능',
    ],
    targetAudience:
      '도시근로자 가구 월평균 소득 70% 이하의 무주택 세대주, 신혼부부, 청년, 대학생, 취업준비생 등',
  },
}

export const RENTAL_TYPE_GUIDE_DEFAULT: RentalTypeGuide = {
  summary:
    '공공임대주택은 LH·SH 등 공공기관이 무주택 저소득층의 주거 안정을 위해 시중보다 저렴하게 공급하는 임대주택입니다. 청약통장 없이도 소득·자산 기준만 충족하면 수시로 신청할 수 있는 매물입니다.',
  features: [
    '시중 시세보다 저렴한 임대료',
    '청약통장 없이 신청 가능',
    '안정적인 장기 거주 (최장 20년)',
  ],
  targetAudience: '무주택 세대주 중 소득·자산 요건을 충족하는 가구',
}

export const ELIGIBILITY_BASE: EligibilityRequirement[] = [
  { label: '주택 소유', detail: '신청자 본인 및 세대 구성원 전원 무주택' },
  { label: '소득 기준', detail: '도시근로자 가구당 월평균 소득의 70% 이하 (유형별 차등 적용)' },
  { label: '자산 기준', detail: '총 자산 3억 6,100만원 이하 · 자동차 3,803만원 이하 (2026년 기준)' },
  { label: '거주 지역', detail: '신청 단지가 위치한 시·도 또는 인접 지역 거주자 (모집공고 기준 우선순위)' },
]

export const APPLY_STEPS: ApplyStep[] = [
  {
    step: 1,
    title: '자격 요건 확인',
    description:
      '마이홈 포털(myhome.go.kr) 자가진단 또는 LH 청약플러스에서 본인의 소득·자산·거주지 요건을 미리 확인합니다.',
  },
  {
    step: 2,
    title: '신청 접수',
    description:
      'LH 청약플러스(apply.lh.or.kr) 또는 SH 인터넷청약시스템에서 모집공고에 따라 온라인으로 신청합니다. 매입임대는 수시 모집, 전세임대는 연중 상시 모집인 경우가 많습니다.',
  },
  {
    step: 3,
    title: '서류 제출',
    description:
      '주민등록등본, 가족관계증명서, 소득·자산 증빙서류 등을 제출합니다. 무주택 확인은 건축물대장·등기부등본으로 검증됩니다.',
  },
  {
    step: 4,
    title: '입주자 선정 발표',
    description:
      '소득·자산 검증과 우선순위 평가를 거쳐 입주자가 선정됩니다. 발표는 LH·SH 홈페이지와 신청 시 등록한 휴대폰으로 안내됩니다.',
  },
  {
    step: 5,
    title: '계약 체결 및 입주',
    description:
      '당첨자는 지정된 기간 내에 계약금을 납부하고 임대차 계약을 체결합니다. 잔금 납부 후 입주가 가능하며 보증금 대출은 주택도시기금 활용이 가능합니다.',
  },
]

export const PUBLIC_RENTAL_FAQ: FaqItem[] = [
  {
    question: '청약통장이 꼭 필요한가요?',
    answer:
      '매입임대·전세임대는 청약통장이 필요하지 않습니다. 무주택 세대주이며 소득·자산 요건만 충족하면 수시로 신청할 수 있습니다. 다만 영구임대·국민임대 일부 유형은 청약통장 가입 기간이 가점에 반영됩니다.',
  },
  {
    question: '보증금 대출은 어떻게 받나요?',
    answer:
      '주택도시기금의 버팀목 전세자금대출, 청년 전용 버팀목 대출 등을 활용할 수 있습니다. 전세임대의 경우 LH가 전세보증금의 95~100%를 직접 지원하므로 별도 대출 없이도 입주 가능합니다.',
  },
  {
    question: '거주 기간은 얼마나 되나요?',
    answer:
      '기본 임대 기간은 2년이며, 재계약을 통해 최장 20년까지 거주할 수 있습니다. 단, 재계약 시점에 무주택·소득·자산 요건을 다시 충족해야 합니다.',
  },
  {
    question: '월세를 보증금으로 전환할 수 있나요?',
    answer:
      '대부분의 공공임대는 보증금 일부를 추가 납부하면 월세를 인하해주는 보증금-월세 상호전환 제도를 운영합니다. 전환 한도와 비율은 모집공고문에 명시되며 매물 상세에도 표기됩니다.',
  },
  {
    question: '공공임대도 노후 주택인가요?',
    answer:
      '매입임대는 LH가 매입한 기존 주택이므로 노후도가 다양합니다. 다만 매입 전 안전·시설 점검을 거치며, 입주 전 도배·장판·청소 등 기본 보수가 이루어집니다. 전세임대는 입주자가 직접 주택을 선택하므로 본인이 원하는 상태의 주택을 고를 수 있습니다.',
  },
  {
    question: '이사 시 보증금은 돌려받나요?',
    answer:
      '계약 종료 또는 중도 해지 시 임대차보호법에 따라 보증금 전액을 돌려받습니다. 공공기관이 임대인이므로 일반 전세보다 보증금 반환 안전성이 매우 높은 편입니다.',
  },
]

export const APPLY_LINKS = {
  lh: {
    label: 'LH 청약플러스',
    url: 'https://apply.lh.or.kr',
    description: '한국토지주택공사 공공임대 신청·공고 조회',
  },
  myhome: {
    label: '마이홈 포털',
    url: 'https://www.myhome.go.kr',
    description: '주거복지 종합 포털 · 자가진단 · 통합 공고 조회',
  },
  sh: {
    label: 'SH 인터넷청약시스템',
    url: 'https://www.i-sh.co.kr',
    description: '서울주택도시공사 공공임대 신청 (서울 거주자)',
  },
}
