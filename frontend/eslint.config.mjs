// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  {
    ignores: [
      '.nuxt/**',
      '.output/**',
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'public/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
      },
      globals: {
        // Nuxt auto-imports
        $fetch: 'readonly',
        useHead: 'readonly',
        useSeoMeta: 'readonly',
        useRoute: 'readonly',
        useRouter: 'readonly',
        useRuntimeConfig: 'readonly',
        useFetch: 'readonly',
        useAsyncData: 'readonly',
        useLazyFetch: 'readonly',
        useLazyAsyncData: 'readonly',
        useNuxtApp: 'readonly',
        useState: 'readonly',
        useCookie: 'readonly',
        useError: 'readonly',
        clearError: 'readonly',
        createError: 'readonly',
        // showError: clearError·createError 와 같은 #app/composables/error 모듈의
        // 자동 import 다(.nuxt/imports.d.ts 에서 한 줄로 함께 export 됨).
        // setup 본문 밖(watch 콜백 등)에서 에러 페이지를 띄우려면 throw 가 아니라 이걸 써야 한다.
        showError: 'readonly',
        defineNuxtComponent: 'readonly',
        definePageMeta: 'readonly',
        navigateTo: 'readonly',
        abortNavigation: 'readonly',
        addRouteMiddleware: 'readonly',
        setPageLayout: 'readonly',
        defineNuxtRouteMiddleware: 'readonly',
        // Nuxt SSR 응답 헬퍼 (앱 코드에서 자동 import 되는 것만 등록한다)
        //
        // setResponseHeader 는 여기 있으면 안 된다 — h3 유틸이고 server/ 디렉터리 전용
        // 자동 import 라서 pages/composables 에서는 번들에 import 가 붙지 않는다.
        // 이 항목이 no-undef 를 눌러 준 탓에 SSR 에서 항상 ReferenceError 가 나는 코드가
        // lint 초록으로 통과했다. 앱 코드에서는 useResponseHeader() 를 쓴다.
        useRequestEvent: 'readonly',
        useResponseHeader: 'readonly',
        setResponseStatus: 'readonly',
        useApiBase: 'readonly',
        useAdminAuth: 'readonly',
        useAdminArticles: 'readonly',
        useAdminGuides: 'readonly',
        // Vue
        ref: 'readonly',
        reactive: 'readonly',
        computed: 'readonly',
        watch: 'readonly',
        watchEffect: 'readonly',
        onMounted: 'readonly',
        onUnmounted: 'readonly',
        onBeforeMount: 'readonly',
        onBeforeUnmount: 'readonly',
        nextTick: 'readonly',
        defineProps: 'readonly',
        defineEmits: 'readonly',
        defineExpose: 'readonly',
        withDefaults: 'readonly',
      },
    },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-console': 'warn',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/no-unused-vars': 'warn',
      'vue/html-indent': 'off',
      'vue/attributes-order': 'off',
      'vue/html-closing-bracket-spacing': 'off',
      'vue/require-default-prop': 'off',
      'prefer-const': 'warn',
    },
  },
  {
    files: ['plugins/msw.client.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Regression guard: all composables, pages, and components must use useApiBase()
    // instead of accessing config.public.apiBase directly.
    // Exceptions (image URLs, useApiBase itself) use eslint-disable-next-line comments.
    files: ['composables/**/*.ts', 'pages/**/*.vue', 'components/**/*.vue'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.property.name='public'][property.name='apiBase']",
          message: "Use useApiBase() instead of config.public.apiBase. Add eslint-disable-next-line only for image/OG URL construction that must remain public.",
        },
      ],
    },
  },
]
