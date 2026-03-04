<template>
  <div class="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
    <h1 class="text-2xl md:text-3xl font-bold text-slate-900 mb-8">
      문의하기
    </h1>

    <div class="space-y-8 text-slate-600 text-sm md:text-base leading-relaxed">
      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-3">
          연락처
        </h2>
        <p>
          일상킷 서비스 이용 중 궁금한 점이나 건의사항이 있으시면
          아래 이메일로 문의해 주세요. 확인 후 빠르게 답변드리겠습니다.
        </p>
        <div class="mt-4 bg-slate-50 rounded-lg p-6">
          <dl class="space-y-3">
            <div>
              <dt class="text-xs text-slate-500">이메일</dt>
              <dd class="mt-1">
                <a
                  href="mailto:contact@ilsangkit.co.kr"
                  class="text-primary hover:text-primary-600 font-medium"
                >
                  contact@ilsangkit.co.kr
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-3">
          문의 유형별 안내
        </h2>
        <div class="space-y-4">
          <div class="bg-slate-50 rounded-lg p-4">
            <h3 class="text-sm font-bold text-slate-800 mb-2">서비스 이용 관련 문의</h3>
            <p class="text-sm">일상킷 서비스 사용 중 겪는 불편사항, 기능 개선 요청, 이용 방법 등에 대해 문의해 주세요.</p>
          </div>
          <div class="bg-slate-50 rounded-lg p-4">
            <h3 class="text-sm font-bold text-slate-800 mb-2">데이터 오류 및 수정 요청</h3>
            <p class="text-sm">시설 위치, 운영시간, 전화번호 등의 정보가 실제와 다른 경우 알려주시면 빠르게 수정하겠습니다. 해당 시설의 이름과 정확한 정보를 함께 보내주시면 더 빠른 처리가 가능합니다.</p>
          </div>
          <div class="bg-slate-50 rounded-lg p-4">
            <h3 class="text-sm font-bold text-slate-800 mb-2">제휴 및 협업 문의</h3>
            <p class="text-sm">일상킷과의 데이터 연동, API 활용, 콘텐츠 협업 등 비즈니스 제휴에 관심이 있으시면 문의해 주세요.</p>
          </div>
          <div class="bg-slate-50 rounded-lg p-4">
            <h3 class="text-sm font-bold text-slate-800 mb-2">기타 건의사항</h3>
            <p class="text-sm">일상킷을 더 좋은 서비스로 만들기 위한 아이디어나 건의사항을 보내주세요. 모든 의견을 소중히 검토합니다.</p>
          </div>
        </div>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-3">
          답변 안내
        </h2>
        <div class="bg-blue-50 rounded-lg p-5">
          <ul class="space-y-3 text-sm">
            <li class="flex items-start gap-2">
              <span class="text-primary font-bold mt-0.5">&#8226;</span>
              <span>문의 접수 후 <strong>영업일 기준 1~2일 이내</strong>에 답변드리고 있습니다.</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-primary font-bold mt-0.5">&#8226;</span>
              <span>데이터 수정 요청은 확인 후 <strong>3~5일 이내</strong>에 반영됩니다.</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-primary font-bold mt-0.5">&#8226;</span>
              <span>긴급한 데이터 오류는 빠르게 처리하고 있으니 가능한 상세히 알려주세요.</span>
            </li>
          </ul>
        </div>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-3">
          자주 묻는 질문
        </h2>
        <p class="mb-3">
          문의 전에 <NuxtLink to="/faq" class="text-primary hover:text-primary-600 font-medium">자주 묻는 질문(FAQ)</NuxtLink> 페이지를 먼저 확인해 보시면 빠르게 답을 찾으실 수 있습니다.
        </p>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 mb-3">
          관련 페이지
        </h2>
        <ul class="list-disc pl-5 space-y-2">
          <li>
            <NuxtLink to="/about" class="text-primary hover:text-primary-600">소개</NuxtLink>
            — 일상킷 서비스에 대해 알아보기
          </li>
          <li>
            <NuxtLink to="/faq" class="text-primary hover:text-primary-600">자주 묻는 질문</NuxtLink>
            — 서비스 이용 관련 FAQ
          </li>
          <li>
            <NuxtLink to="/privacy" class="text-primary hover:text-primary-600">개인정보처리방침</NuxtLink>
            — 개인정보 처리에 관한 안내
          </li>
          <li>
            <NuxtLink to="/terms" class="text-primary hover:text-primary-600">이용약관</NuxtLink>
            — 서비스 이용에 관한 약관
          </li>
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
  title: '문의하기',
  description: '일상킷 서비스 이용 관련 문의, 데이터 오류 신고, 제휴 문의 등을 접수할 수 있습니다.',
  path: '/contact',
})

setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '문의하기', url: '/contact' },
])
</script>
