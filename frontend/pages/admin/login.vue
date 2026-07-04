<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-50 px-4">
    <form
      class="w-full max-w-sm bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-4"
      @submit.prevent="onSubmit"
    >
      <h1 class="text-lg font-semibold text-slate-900 text-center">
        어드민 로그인
      </h1>

      <div>
        <label for="admin-password" class="block text-sm text-slate-600 mb-1">비밀번호</label>
        <input
          id="admin-password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
      </div>

      <p v-if="error" role="alert" class="text-sm text-red-600">
        {{ error }}
      </p>

      <button
        type="submit"
        :disabled="loading"
        class="w-full rounded-md bg-primary text-white py-2 text-sm font-medium disabled:opacity-50"
      >
        {{ loading ? '로그인 중...' : '로그인' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

import { ref } from 'vue'

useSeoMeta({
  robots: 'noindex, nofollow',
  title: '어드민 로그인',
})

const password = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await useAdminAuth().login(password.value)
    await navigateTo('/admin')
  } catch {
    error.value = '비밀번호가 올바르지 않거나 로그인할 수 없습니다'
  } finally {
    loading.value = false
  }
}
</script>
