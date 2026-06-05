<template>
  <div class="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-8">
    <StaticPageHeader
      title="일상킷 소개"
      lead="부동산 실거래가와 내 주변 생활시설을 한곳에서."
    />

    <div class="space-y-5 md:space-y-6 text-slate-600 text-sm md:text-base leading-relaxed">
      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-3">
          서비스 소개
        </h2>
        <p class="mb-3">
          일상킷은 부동산 실거래가와 내 주변 생활시설 정보를 한곳에서 찾을 수 있는 서비스입니다.
          아파트·빌라·오피스텔·토지 실거래가 조회부터 병원, 약국, 주차장 등 전국 생활시설 검색까지,
          일상에서 필요한 정보를 빠르고 편리하게 제공합니다.
        </p>
        <p class="mb-3">
          "우리 동네 아파트 시세가 얼마지?", "가까운 공공화장실이 어디 있지?",
          "우리 동네 쓰레기 배출 요일이 언제지?" 같은 일상의 궁금증을 해결하기 위해
          만들어졌습니다. 국토교통부 실거래 데이터와 공공데이터를 기반으로 정확한 정보를 제공하며,
          회원가입 없이 누구나 이용할 수 있습니다.
        </p>
        <p>
          일상킷은 단순한 시설 검색을 넘어, 카테고리별 생활 가이드 콘텐츠를 통해
          실생활에서 바로 활용할 수 있는 유용한 팁과 최신 정보를 함께 제공합니다.
          생활시설을 더 잘 이해하고 똑똑하게 활용하는 데 도움이 되는 정보를 만나보세요.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-3">
          운영 목적
        </h2>
        <p class="mb-3">
          공공데이터는 국민의 세금으로 수집·관리되는 소중한 자산이지만,
          여러 기관에 흩어져 있어 필요한 정보를 찾기 어려운 경우가 많습니다.
          일상킷은 이러한 공공데이터를 한곳에 모아 누구나 쉽게 접근할 수 있도록 만드는 것을 목표로 합니다.
        </p>
        <p>
          특히 디지털 정보 접근이 어려운 고령자, 지역 정보가 낯선 이사 직후 주민,
          외출 중 급하게 시설을 찾아야 하는 시민 등 다양한 상황에서
          생활 편의 정보를 빠르게 제공하여 일상의 불편을 해소하고자 합니다.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-3">
          제공 정보
        </h2>
        <p class="mb-4">
          일상킷은 전국 생활시설 15종과 부동산 실거래가(아파트·빌라·오피스텔·토지) 정보를 카테고리별로 제공합니다.
        </p>
        <ul class="list-disc pl-5 space-y-2">
          <li><strong class="text-slate-900">공공화장실</strong> — 전국 공공화장실의 위치, 운영 시간, 장애인 시설 여부 등을 확인할 수 있습니다.</li>
          <li><strong class="text-slate-900">쓰레기 배출정보</strong> — 지역별 생활쓰레기 배출 요일, 시간, 방법을 안내합니다.</li>
          <li><strong class="text-slate-900">무료와이파이</strong> — 공공 무료 와이파이 설치 장소와 이용 정보를 제공합니다.</li>
          <li><strong class="text-slate-900">의류수거함</strong> — 주변 의류수거함의 위치를 확인할 수 있습니다.</li>
          <li><strong class="text-slate-900">공영주차장</strong> — 전국 공영주차장의 위치, 요금, 운영 시간 등을 확인할 수 있습니다.</li>
          <li><strong class="text-slate-900">자동심장충격기(AED)</strong> — 주변 자동심장충격기(AED) 설치 위치를 확인할 수 있습니다.</li>
          <li><strong class="text-slate-900">공공도서관</strong> — 전국 공공도서관의 위치와 운영 정보를 확인할 수 있습니다.</li>
          <li><strong class="text-slate-900">병원</strong> — 전국 병원의 위치, 진료과목, 운영 시간 등을 확인할 수 있습니다.</li>
          <li><strong class="text-slate-900">약국</strong> — 전국 약국의 위치와 운영 시간을 확인할 수 있습니다.</li>
          <li><strong class="text-slate-900">공원</strong> — 전국 도시공원의 위치와 종류, 면적 정보를 확인할 수 있습니다.</li>
          <li><strong class="text-slate-900">학교</strong> — 전국 학교의 위치와 기본 정보를 확인할 수 있습니다.</li>
          <li><strong class="text-slate-900">전통시장</strong> — 전국 전통시장의 위치와 정보를 확인할 수 있습니다.</li>
          <li><strong class="text-slate-900">어린이집</strong> — 전국 어린이집의 위치와 운영 정보를 확인할 수 있습니다.</li>
          <li><strong class="text-slate-900">전기차 충전소</strong> — 전국 전기차 충전소의 위치와 충전기 정보를 확인할 수 있습니다.</li>
          <li><strong class="text-slate-900">체육시설</strong> — 전국 공공체육시설의 위치와 종목 정보를 확인할 수 있습니다.</li>
          <li><strong class="text-slate-900">아파트 실거래가</strong> — 전국 아파트 매매·전월세 실거래가를 지역별, 단지별로 조회할 수 있습니다.</li>
          <li><strong class="text-slate-900">빌라 실거래가</strong> — 전국 연립다세대(빌라) 매매·전월세 실거래가를 지역별로 확인할 수 있습니다.</li>
          <li><strong class="text-slate-900">오피스텔 실거래가</strong> — 전국 오피스텔 매매·전월세 실거래가를 지역별, 건물별로 조회할 수 있습니다.</li>
          <li><strong class="text-slate-900">토지 실거래가</strong> — 전국 토지(대지·전·답·임야 등) 매매 실거래가를 동 단위로, 지목·용도지역별 평당 시세와 함께 확인할 수 있습니다.</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-3">
          서비스 특징
        </h2>
        <ul class="list-disc pl-5 space-y-2">
          <li>
            <strong class="text-slate-900">지역별 검색</strong>
            — 시/도, 구/군 단위로 원하는 지역의 시설을 검색할 수 있습니다.
          </li>
          <li>
            <strong class="text-slate-900">통합 검색</strong>
            — 여러 종류의 생활 편의 시설을 하나의 서비스에서 검색할 수 있습니다.
          </li>
          <li>
            <strong class="text-slate-900">지도 확인</strong>
            — 시설 상세 페이지에서 카카오맵으로 정확한 위치를 확인할 수 있습니다.
          </li>
          <li>
            <strong class="text-slate-900">무료 이용</strong>
            — 회원가입 없이 누구나 무료로 이용할 수 있습니다.
          </li>
          <li>
            <strong class="text-slate-900">생활 가이드</strong>
            — 카테고리별 생활 가이드 콘텐츠로 실용적인 팁과 정보를 제공합니다.
          </li>
        </ul>
      </section>

      <section id="data-sources">
        <h2 class="text-lg font-semibold text-slate-900 mb-3">
          데이터 출처
        </h2>
        <p class="mb-3">
          일상킷에서 제공하는 시설 정보는
          <a
            href="https://www.data.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:text-primary"
          >공공데이터포털(data.go.kr)</a>에서
          제공하는 공공데이터를 기반으로 하며, 부동산 실거래가 데이터는
          국토교통부 실거래가 공개시스템에서 제공하는 공식 데이터를 활용합니다.
          데이터는 주기적으로 동기화되며, 실제 현장 상황과 차이가 있을 수 있습니다.
          정확한 정보는 해당 기관에 직접 문의해 주시기 바랍니다.
        </p>

        <div class="bg-slate-50 rounded-lg p-4 mb-4">
          <p class="text-xs text-slate-500 mb-3">
            공공누리 제1유형(출처표시) — 본 서비스는 아래 공공데이터를 이용하며, 해당 저작물은 각 제공기관에 저작권이 있습니다.
          </p>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-200">
                  <th class="text-left py-2 pr-4 font-medium text-slate-900">데이터명</th>
                  <th class="text-left py-2 pr-4 font-medium text-slate-900">제공기관</th>
                  <th class="text-left py-2 font-medium text-slate-900">출처</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="src in dataSources" :key="src.url">
                  <td class="py-2 pr-4">{{ src.datasetName }}</td>
                  <td class="py-2 pr-4">{{ src.provider }}</td>
                  <td class="py-2">
                    <a :href="src.url" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary">{{ sourceLabel(src.url) }}</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-3">
          운영팀
        </h2>
        <p class="mb-3">
          일상킷은 공공데이터의 가치를 시민에게 전달하고자 하는 소규모 개발팀이 운영합니다.
          데이터의 정확성과 서비스 개선을 위해 지속적으로 노력하고 있으며,
          이용자 여러분의 피드백을 소중하게 반영합니다.
        </p>
        <p>
          잘못된 정보나 개선 의견이 있으시면 아래 연락처로 알려주세요.
          더 나은 서비스를 만들어 나가겠습니다.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-3">
          문의
        </h2>
        <p>
          서비스 이용 중 문의사항이나 데이터 오류 신고, 개선 제안이 있으시면
          아래로 연락해 주시기 바랍니다.
        </p>
        <ul class="list-disc pl-5 mt-2 space-y-1">
          <li>이메일: <a href="mailto:contact@ilsangkit.co.kr" class="text-primary hover:text-primary">contact@ilsangkit.co.kr</a></li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import {
  FACILITY_DATA_SOURCE,
  REAL_ESTATE_DATASETS,
  type DataSourceInfo,
} from '~/utils/dataSource'

// 데이터 출처 테이블은 dataSource.ts 레지스트리를 단일 소스로 사용 (시설 + 부동산 세부 데이터셋)
const dataSources: DataSourceInfo[] = [
  ...Object.values(FACILITY_DATA_SOURCE),
  ...REAL_ESTATE_DATASETS,
]

function sourceLabel(url: string): string {
  return url.includes('data.go.kr') ? '공공데이터포털' : '제공기관 사이트'
}

const { setMeta } = useFacilityMeta()
const { setBreadcrumbSchema } = useStructuredData()

setMeta({
  title: '일상킷 소개',
  description: '일상킷 서비스 소개와 제공 정보, 데이터 출처를 확인하세요.',
  path: '/about',
})

setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '소개', url: '/about' },
])
</script>
