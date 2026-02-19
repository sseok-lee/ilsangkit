<template>
  <div class="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
    <h1 class="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-8">
      일상킷 소개
    </h1>

    <div class="space-y-8 text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed">
      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          서비스 소개
        </h2>
        <p>
          일상킷은 내 주변 생활 편의 정보를 한 번에 찾을 수 있는 서비스입니다.
          전국 공공시설과 생활 정보를 지역별로 통합 검색하여,
          일상에서 필요한 정보를 빠르고 편리하게 제공합니다.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          제공 정보
        </h2>
        <ul class="list-disc pl-5 space-y-2">
          <li>
            <strong class="text-slate-900 dark:text-white">공공화장실</strong>
            — 전국 공공화장실의 위치, 운영 시간, 장애인 시설 여부 등을 확인할 수 있습니다.
          </li>
          <li>
            <strong class="text-slate-900 dark:text-white">쓰레기 배출</strong>
            — 지역별 생활쓰레기 배출 요일, 시간, 방법을 안내합니다.
          </li>
          <li>
            <strong class="text-slate-900 dark:text-white">무료 와이파이</strong>
            — 공공 무료 와이파이 설치 장소와 이용 정보를 제공합니다.
          </li>
          <li>
            <strong class="text-slate-900 dark:text-white">의류수거함</strong>
            — 주변 의류수거함의 위치를 확인할 수 있습니다.
          </li>
          <li>
            <strong class="text-slate-900 dark:text-white">무인민원발급기</strong>
            — 무인민원발급기의 위치와 운영 시간을 확인할 수 있습니다.
          </li>
          <li>
            <strong class="text-slate-900 dark:text-white">공영주차장</strong>
            — 전국 공영주차장의 위치, 요금, 운영 시간 등을 확인할 수 있습니다.
          </li>
          <li>
            <strong class="text-slate-900 dark:text-white">자동심장충격기(AED)</strong>
            — 주변 자동심장충격기(AED) 설치 위치를 확인할 수 있습니다.
          </li>
          <li>
            <strong class="text-slate-900 dark:text-white">공공도서관</strong>
            — 전국 공공도서관의 위치와 운영 정보를 확인할 수 있습니다.
          </li>
          <li>
            <strong class="text-slate-900 dark:text-white">병원</strong>
            — 전국 병원의 위치, 진료과목, 운영 시간 등을 확인할 수 있습니다.
          </li>
          <li>
            <strong class="text-slate-900 dark:text-white">약국</strong>
            — 전국 약국의 위치와 운영 시간을 확인할 수 있습니다.
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          서비스 특징
        </h2>
        <ul class="list-disc pl-5 space-y-2">
          <li>
            <strong class="text-slate-900 dark:text-white">지역별 검색</strong>
            — 시/도, 구/군 단위로 원하는 지역의 시설을 검색할 수 있습니다.
          </li>
          <li>
            <strong class="text-slate-900 dark:text-white">통합 검색</strong>
            — 여러 종류의 생활 편의 시설을 하나의 서비스에서 검색할 수 있습니다.
          </li>
          <li>
            <strong class="text-slate-900 dark:text-white">지도 확인</strong>
            — 시설 상세 페이지에서 카카오맵으로 정확한 위치를 확인할 수 있습니다.
          </li>
          <li>
            <strong class="text-slate-900 dark:text-white">무료 이용</strong>
            — 회원가입 없이 누구나 무료로 이용할 수 있습니다.
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          데이터 출처
        </h2>
        <p class="mb-4">
          일상킷에서 제공하는 모든 정보는
          <a
            href="https://www.data.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            class="text-primary hover:text-primary-600"
          >공공데이터포털(data.go.kr)</a>에서
          제공하는 공공데이터를 기반으로 합니다.
          데이터는 주기적으로 동기화되며, 실제 현장 상황과 차이가 있을 수 있습니다.
        </p>

        <div class="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mb-4">
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">
            공공누리 제1유형(출처표시) — 본 서비스는 아래 공공데이터를 이용하며, 해당 저작물은 각 제공기관에 저작권이 있습니다.
          </p>

          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-700">
                  <th class="text-left py-2 pr-4 font-medium text-slate-900 dark:text-white">데이터명</th>
                  <th class="text-left py-2 pr-4 font-medium text-slate-900 dark:text-white">제공기관</th>
                  <th class="text-left py-2 font-medium text-slate-900 dark:text-white">출처</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
                <tr>
                  <td class="py-2 pr-4">전국공중화장실표준데이터</td>
                  <td class="py-2 pr-4">행정안전부</td>
                  <td class="py-2">
                    <a href="https://www.data.go.kr/data/15012892/standard.do" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary-600">공공데이터포털</a>
                  </td>
                </tr>
                <tr>
                  <td class="py-2 pr-4">행정안전부_생활쓰레기배출정보 조회서비스</td>
                  <td class="py-2 pr-4">행정안전부</td>
                  <td class="py-2">
                    <a href="https://www.data.go.kr/data/15155080/openapi.do" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary-600">공공데이터포털</a>
                  </td>
                </tr>
                <tr>
                  <td class="py-2 pr-4">전국무료와이파이표준데이터</td>
                  <td class="py-2 pr-4">행정안전부</td>
                  <td class="py-2">
                    <a href="https://www.data.go.kr/data/15013116/standard.do" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary-600">공공데이터포털</a>
                  </td>
                </tr>
                <tr>
                  <td class="py-2 pr-4">전국의류수거함표준데이터</td>
                  <td class="py-2 pr-4">행정안전부</td>
                  <td class="py-2">
                    <a href="https://www.data.go.kr/data/15139214/standard.do" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary-600">공공데이터포털</a>
                  </td>
                </tr>
                <tr>
                  <td class="py-2 pr-4">행정안전부_무인민원발급기정보 조회서비스</td>
                  <td class="py-2 pr-4">행정안전부</td>
                  <td class="py-2">
                    <a href="https://www.data.go.kr/data/15154774/openapi.do" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary-600">공공데이터포털</a>
                  </td>
                </tr>
                <tr>
                  <td class="py-2 pr-4">전국공영주차장표준데이터</td>
                  <td class="py-2 pr-4">행정안전부</td>
                  <td class="py-2">
                    <a href="https://www.data.go.kr/data/15012896/standard.do" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary-600">공공데이터포털</a>
                  </td>
                </tr>
                <tr>
                  <td class="py-2 pr-4">자동심장충격기(AED) 설치장소</td>
                  <td class="py-2 pr-4">보건복지부</td>
                  <td class="py-2">
                    <a href="https://www.data.go.kr/data/15000652/openapi.do" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary-600">공공데이터포털</a>
                  </td>
                </tr>
                <tr>
                  <td class="py-2 pr-4">전국공공도서관표준데이터</td>
                  <td class="py-2 pr-4">행정안전부</td>
                  <td class="py-2">
                    <a href="https://www.data.go.kr/data/15013109/standard.do" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary-600">공공데이터포털</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          문의
        </h2>
        <p>
          서비스 이용 중 문의사항이 있으시면 아래로 연락해 주시기 바랍니다.
        </p>
        <ul class="list-disc pl-5 mt-2 space-y-1">
          <li>이메일: <a href="mailto:contact@ilsangkit.co.kr" class="text-primary hover:text-primary-600">contact@ilsangkit.co.kr</a></li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'

const { setMeta } = useFacilityMeta()
const { setBreadcrumbSchema } = useStructuredData()

setMeta({
  title: '소개',
  description: '일상킷은 내 주변 생활 편의 정보를 한 번에 찾을 수 있는 서비스입니다. 전국 공공시설과 생활 편의 정보를 지역별로 통합 검색합니다.',
  path: '/about',
})

setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '소개', url: '/about' },
])
</script>
