<template>
  <div class="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-12">
    <h1 class="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-8">
      문의하기
    </h1>

    <div class="space-y-8 text-slate-600 dark:text-slate-300 text-sm md:text-base leading-relaxed">
      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          연락처
        </h2>
        <p>
          일상킷 서비스 이용 중 궁금한 점이나 건의사항이 있으시면
          아래 이메일로 문의해 주세요. 확인 후 빠르게 답변드리겠습니다.
        </p>
        <div class="mt-4 bg-slate-50 dark:bg-slate-800 rounded-lg p-6">
          <dl class="space-y-3">
            <div>
              <dt class="text-xs text-slate-500 dark:text-slate-400">이메일</dt>
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
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          문의 안내
        </h2>
        <ul class="list-disc pl-5 space-y-2">
          <li>서비스 이용 관련 문의</li>
          <li>데이터 오류 및 수정 요청</li>
          <li>제휴 및 협업 문의</li>
          <li>기타 건의사항</li>
        </ul>
      </section>

      <section>
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white mb-3">
          관련 페이지
        </h2>
        <ul class="list-disc pl-5 space-y-2">
          <li>
            <NuxtLink to="/about" class="text-primary hover:text-primary-600">소개</NuxtLink>
            — 일상킷 서비스에 대해 알아보기
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
