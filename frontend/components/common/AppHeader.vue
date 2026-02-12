<template>
  <header
    :class="[
      'sticky top-0 z-50 flex items-center justify-between p-4 pb-2 md:px-6 md:py-4',
      'bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm',
      'border-b border-transparent dark:border-slate-800',
      'transition-colors duration-300',
      props.transparent ? 'bg-transparent backdrop-blur-none border-transparent' : ''
    ]"
  >
    <!-- Left: Back Button (if enabled) or Logo -->
    <div class="flex items-center gap-2">
      <button
        v-if="props.showBackButton"
        class="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[#111418] dark:text-white"
        aria-label="뒤로가기"
        @click="handleBack"
      >
        <span class="material-symbols-outlined text-[24px]">arrow_back</span>
      </button>

      <NuxtLink v-if="!props.showBackButton" to="/" class="flex items-center gap-2">
        <img src="/icons/logo.webp" alt="일상킷 로고" class="size-10 shrink-0 rounded-lg" />
        <h2 class="text-[#111418] dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]">
          일상킷
        </h2>
      </NuxtLink>
    </div>

    <!-- Center: Desktop Navigation -->
    <nav class="hidden md:flex items-center gap-6">
      <NuxtLink
        to="/search?category=toilet"
        class="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary transition-colors"
      >
        <CategoryIcon category-id="toilet" size="sm" />
        화장실
      </NuxtLink>
      <NuxtLink
        to="/search?category=wifi"
        class="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary transition-colors"
      >
        <CategoryIcon category-id="wifi" size="sm" />
        와이파이
      </NuxtLink>
      <NuxtLink
        to="/search?category=clothes"
        class="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary transition-colors"
      >
        <CategoryIcon category-id="clothes" size="sm" />
        의류수거함
      </NuxtLink>
      <NuxtLink
        to="/search?category=kiosk"
        class="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary transition-colors"
      >
        <CategoryIcon category-id="kiosk" size="sm" />
        발급기
      </NuxtLink>
      <NuxtLink
        to="/search?category=parking"
        class="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary transition-colors"
      >
        <CategoryIcon category-id="parking" size="sm" />
        주차장
      </NuxtLink>
      <NuxtLink
        to="/search?category=aed"
        class="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary transition-colors"
      >
        <CategoryIcon category-id="aed" size="sm" />
        AED
      </NuxtLink>
      <NuxtLink
        to="/search?category=library"
        class="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary transition-colors"
      >
        <CategoryIcon category-id="library" size="sm" />
        도서관
      </NuxtLink>
      <NuxtLink
        to="/search?category=trash"
        class="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary transition-colors"
      >
        <CategoryIcon category-id="trash" size="sm" />
        쓰레기
      </NuxtLink>
    </nav>

    <!-- Right: Desktop Actions & Mobile Menu Button -->
    <div class="flex items-center justify-end">
      <!-- Desktop Actions -->
      <div class="hidden md:flex items-center gap-3">
        <button
          aria-label="다크모드 전환"
          class="p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg transition-colors"
          @click="handleDarkModeToggle"
        >
          <span class="material-symbols-outlined text-[24px]">dark_mode</span>
        </button>
      </div>

      <!-- Mobile Menu Button -->
      <button
        class="md:hidden flex size-10 cursor-pointer items-center justify-center overflow-hidden rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[#111418] dark:text-white"
        aria-label="메뉴"
        :aria-expanded="isMobileMenuOpen"
        @click="toggleMobileMenu"
      >
        <span class="material-symbols-outlined text-[28px]">menu</span>
      </button>
    </div>
  </header>

  <!-- Mobile Menu -->
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div
      v-if="isMobileMenuOpen"
      data-testid="mobile-menu"
      role="navigation"
      aria-label="모바일 메뉴"
      class="md:hidden fixed top-[60px] left-0 right-0 z-40 bg-background-light dark:bg-background-dark border-b border-slate-200 dark:border-slate-800 shadow-lg"
    >
      <nav class="flex flex-col p-4 gap-2">
        <NuxtLink
          to="/"
          class="px-4 py-3 text-[#111418] dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium"
          @click="closeMobileMenu"
        >
          홈
        </NuxtLink>
        <NuxtLink
          to="/search"
          class="px-4 py-3 text-[#111418] dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium"
          @click="closeMobileMenu"
        >
          지도
        </NuxtLink>
        <div class="h-px bg-slate-200 dark:bg-slate-800 my-2"></div>
        <NuxtLink
          to="/search?category=toilet"
          class="px-4 py-3 text-[#111418] dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
          @click="closeMobileMenu"
        >
          <CategoryIcon category-id="toilet" size="sm" />
          화장실
        </NuxtLink>
        <NuxtLink
          to="/search?category=wifi"
          class="px-4 py-3 text-[#111418] dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
          @click="closeMobileMenu"
        >
          <CategoryIcon category-id="wifi" size="sm" />
          와이파이
        </NuxtLink>
        <NuxtLink
          to="/search?category=clothes"
          class="px-4 py-3 text-[#111418] dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
          @click="closeMobileMenu"
        >
          <CategoryIcon category-id="clothes" size="sm" />
          의류수거함
        </NuxtLink>
        <NuxtLink
          to="/search?category=kiosk"
          class="px-4 py-3 text-[#111418] dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
          @click="closeMobileMenu"
        >
          <CategoryIcon category-id="kiosk" size="sm" />
          발급기
        </NuxtLink>
        <NuxtLink
          to="/search?category=parking"
          class="px-4 py-3 text-[#111418] dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
          @click="closeMobileMenu"
        >
          <CategoryIcon category-id="parking" size="sm" />
          주차장
        </NuxtLink>
        <NuxtLink
          to="/search?category=aed"
          class="px-4 py-3 text-[#111418] dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
          @click="closeMobileMenu"
        >
          <CategoryIcon category-id="aed" size="sm" />
          AED
        </NuxtLink>
        <NuxtLink
          to="/search?category=library"
          class="px-4 py-3 text-[#111418] dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
          @click="closeMobileMenu"
        >
          <CategoryIcon category-id="library" size="sm" />
          도서관
        </NuxtLink>
        <NuxtLink
          to="/search?category=trash"
          class="px-4 py-3 text-[#111418] dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
          @click="closeMobileMenu"
        >
          <CategoryIcon category-id="trash" size="sm" />
          쓰레기
        </NuxtLink>
      </nav>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Props {
  transparent?: boolean
  showBackButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  transparent: false,
  showBackButton: false,
})

const emit = defineEmits<{
  back: []
  darkModeToggle: []
}>()

const isMobileMenuOpen = ref(false)

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

const handleBack = () => {
  emit('back')
}

const handleDarkModeToggle = () => {
  emit('darkModeToggle')
}

// Escape 키로 모바일 메뉴 닫기
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isMobileMenuOpen.value) {
    closeMobileMenu()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
