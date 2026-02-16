<template>
  <div class="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
    <h1 class="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-8">
      개인정보처리방침
    </h1>

    <div class="space-y-8 text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed">
      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          1. 개인정보의 처리 목적
        </h2>
        <p>
          일상킷(이하 "서비스")은 다음의 목적을 위하여 개인정보를 처리합니다.
          처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며,
          이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
        </p>
        <ul class="list-disc pl-5 mt-2 space-y-1">
          <li>지역별 생활 편의 시설 검색 서비스 제공</li>
          <li>서비스 이용 통계 분석 및 서비스 개선</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          2. 수집하는 개인정보 항목
        </h2>
        <p>서비스는 다음과 같은 개인정보를 수집합니다.</p>
        <ul class="list-disc pl-5 mt-2 space-y-1">
          <li>
            <strong class="text-slate-900 dark:text-white">쿠키 및 분석 데이터</strong>:
            Google Analytics(GA4)를 통해 서비스 이용 패턴(페이지 방문, 체류 시간 등)을 수집합니다.
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          3. 개인정보의 처리 및 보유 기간
        </h2>
        <p>
          서비스는 회원가입을 요구하지 않으며, 별도의 개인정보를 서버에 저장하지 않습니다.
          쿠키 및 분석 데이터는 Google Analytics 정책에 따라 보관됩니다.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          4. 개인정보의 제3자 제공
        </h2>
        <p>서비스는 다음과 같은 제3자 서비스를 이용합니다.</p>
        <ul class="list-disc pl-5 mt-2 space-y-1">
          <li>
            <strong class="text-slate-900 dark:text-white">Google Analytics(GA4)</strong>:
            서비스 이용 통계 분석 목적으로 쿠키 및 이용 데이터를 수집합니다.
          </li>
          <li>
            <strong class="text-slate-900 dark:text-white">Kakao Maps API</strong>:
            지도 표시를 위해 사용됩니다.
          </li>
          <li>
            <strong class="text-slate-900 dark:text-white">Google AdSense</strong>:
            광고 제공을 위해 쿠키를 사용할 수 있습니다.
          </li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          5. 쿠키의 사용
        </h2>
        <p>
          서비스는 사용자 경험 개선 및 통계 분석을 위해 쿠키를 사용합니다.
          사용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나,
          이 경우 일부 서비스 이용에 제한이 있을 수 있습니다.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          6. 개인정보의 안전성 확보 조치
        </h2>
        <p>서비스는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
        <ul class="list-disc pl-5 mt-2 space-y-1">
          <li>HTTPS 암호화 통신 적용</li>
          <li>개인정보의 최소 수집 원칙 준수</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          7. 이용자의 권리
        </h2>
        <p>
          이용자는 브라우저의 쿠키 설정을 통해 쿠키 저장을 거부할 수 있습니다.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          8. 개인정보 보호책임자 및 문의
        </h2>
        <p>
          개인정보 처리에 관한 문의사항이 있으신 경우 아래로 연락해 주시기 바랍니다.
        </p>
        <ul class="list-disc pl-5 mt-2 space-y-1">
          <li>서비스명: 일상킷</li>
          <li>이메일: <a href="mailto:contact@ilsangkit.co.kr" class="text-primary hover:text-primary-600">contact@ilsangkit.co.kr</a></li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          9. 개인정보처리방침의 변경
        </h2>
        <p>
          이 개인정보처리방침은 2026년 2월 13일부터 적용됩니다.
          변경 사항이 있을 경우 서비스 내 공지를 통해 안내드리겠습니다.
        </p>
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
  title: '개인정보처리방침',
  description: '일상킷 서비스의 개인정보처리방침입니다. 수집 항목, 이용 목적, 제3자 제공 등을 안내합니다.',
  path: '/privacy',
})

setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '개인정보처리방침', url: '/privacy' },
])
</script>
