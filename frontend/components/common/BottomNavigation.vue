<template>
  <nav
    class="md:hidden sticky bottom-0 w-full bg-white dark:bg-[#1e293b] border-t border-slate-100 dark:border-slate-800 pt-2 px-6 flex justify-between items-end h-[80px] z-40 pb-6"
    style="padding-bottom: max(1.5rem, env(safe-area-inset-bottom))"
  >
    <!-- 홈 -->
    <NuxtLink
      to="/"
      class="flex flex-col items-center gap-1 w-12 transition-colors"
      :class="isActiveRoute('/') ? 'text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'"
    >
      <span
        class="material-symbols-outlined"
        :class="isActiveRoute('/') ? 'fill-1' : ''"
      >
        home
      </span>
      <span class="text-[10px] font-medium">홈</span>
    </NuxtLink>

    <!-- 지도 -->
    <NuxtLink
      to="/search"
      class="flex flex-col items-center gap-1 w-12 transition-colors"
      :class="isActiveRoute('/search') ? 'text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'"
    >
      <span
        class="material-symbols-outlined"
        :class="isActiveRoute('/search') ? 'fill-1' : ''"
      >
        map
      </span>
      <span class="text-[10px] font-medium">지도</span>
    </NuxtLink>

    <!-- 저장 (향후 구현) -->
    <button
      class="flex flex-col items-center gap-1 w-12 transition-colors"
      :class="isActiveRoute('/saved') ? 'text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'"
      disabled
      aria-label="저장 (준비 중)"
    >
      <span
        class="material-symbols-outlined"
        :class="isActiveRoute('/saved') ? 'fill-1' : ''"
      >
        favorite
      </span>
      <span class="text-[10px] font-medium">저장</span>
    </button>

    <!-- 내 정보 (향후 구현) -->
    <button
      class="flex flex-col items-center gap-1 w-12 transition-colors"
      :class="isActiveRoute('/profile') ? 'text-primary' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'"
      disabled
      aria-label="내 정보 (준비 중)"
    >
      <span
        class="material-symbols-outlined"
        :class="isActiveRoute('/profile') ? 'fill-1' : ''"
      >
        person
      </span>
      <span class="text-[10px] font-medium">내 정보</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// 현재 라우트가 활성화되어 있는지 확인
const isActiveRoute = (path: string) => {
  return computed(() => {
    // route가 없는 경우 (테스트 환경 등) false 반환
    if (!route || !route.path) {
      return false
    }

    // 정확한 경로 매칭
    if (path === '/') {
      return route.path === '/'
    }
    // /search 경로는 시작 부분이 일치하면 활성화
    if (path === '/search') {
      return route.path.startsWith('/search')
    }
    // 그 외의 경로는 시작 부분 매칭
    return route.path.startsWith(path)
  }).value
}
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.material-symbols-outlined.fill-1 {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Safe area inset support for iOS devices */
@supports (padding-bottom: env(safe-area-inset-bottom)) {
  nav {
    padding-bottom: max(1.5rem, env(safe-area-inset-bottom));
  }
}
</style>
