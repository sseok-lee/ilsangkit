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

      <NuxtLink v-if="!props.showBackButton" to="/" class="flex items-center">
        <img src="/icons/logo.webp" alt="일상킷" class="h-9 md:h-12 shrink-0" />
      </NuxtLink>
    </div>

    <!-- Center: Desktop Navigation (Group Dropdowns) -->
    <nav class="hidden md:flex items-center gap-1">
      <!-- Category Group Dropdowns -->
      <div
        v-for="group in CATEGORY_GROUPS"
        :key="group.title"
        class="relative"
        @mouseenter="openDropdown(group.title)"
        @mouseleave="scheduleCloseDropdown"
      >
        <button
          class="flex items-center gap-1.5 px-3 py-2 text-[15px] font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <span class="material-symbols-outlined text-[18px]">{{ group.icon }}</span>
          {{ group.title }}
          <span class="material-symbols-outlined text-[16px] transition-transform" :class="{ 'rotate-180': activeDropdown === group.title }">expand_more</span>
        </button>
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95 -translate-y-1"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 -translate-y-1"
        >
          <div
            v-if="activeDropdown === group.title"
            class="absolute top-full left-0 mt-1 min-w-[180px] bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 p-2 z-50"
            @mouseenter="cancelCloseDropdown"
            @mouseleave="scheduleCloseDropdown"
          >
            <NuxtLink
              v-for="catId in group.categories"
              :key="catId"
              :to="`/${catId}`"
              class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-[15px] text-slate-700 dark:text-slate-300 transition-colors"
              @click="closeDropdown"
            >
              <CategoryIcon :category-id="catId" size="sm" />
              {{ CATEGORY_META[catId].shortLabel }}
            </NuxtLink>
          </div>
        </Transition>
      </div>

      <!-- Utility Links Divider -->
      <div class="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

      <!-- Utility Links -->
      <NuxtLink
        to="/search"
        class="flex items-center gap-1.5 px-3 py-2 text-[15px] font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <span class="material-symbols-outlined text-[18px]">search</span>
        검색
      </NuxtLink>
      <NuxtLink
        to="/about"
        class="flex items-center gap-1.5 px-3 py-2 text-[15px] font-medium text-slate-600 hover:text-primary dark:text-slate-300 dark:hover:text-primary rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
      >
        <span class="material-symbols-outlined text-[18px]">info</span>
        소개
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
          <span class="material-symbols-outlined text-[24px]">{{ darkModeIcon }}</span>
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
      <nav class="flex flex-col p-4 gap-1">
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
          검색
        </NuxtLink>
        <div class="h-px bg-slate-200 dark:bg-slate-800 my-2"></div>

        <!-- Category Groups -->
        <div v-for="group in CATEGORY_GROUPS" :key="group.title" class="mb-1">
          <div class="px-4 py-2 flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span class="material-symbols-outlined text-[16px] text-primary">{{ group.icon }}</span>
            {{ group.title }}
          </div>
          <NuxtLink
            v-for="catId in group.categories"
            :key="catId"
            :to="`/${catId}`"
            class="pl-6 pr-4 py-2.5 text-[#111418] dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
            @click="closeMobileMenu"
          >
            <CategoryIcon :category-id="catId" size="sm" />
            {{ CATEGORY_META[catId].shortLabel }}
          </NuxtLink>
        </div>

        <div class="h-px bg-slate-200 dark:bg-slate-800 my-2"></div>
        <NuxtLink
          to="/about"
          class="px-4 py-3 text-[#111418] dark:text-slate-300 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium"
          @click="closeMobileMenu"
        >
          소개
        </NuxtLink>
        <div class="h-px bg-slate-200 dark:bg-slate-800 my-2"></div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2">
          <NuxtLink
            to="/privacy"
            class="text-xs text-slate-400 dark:text-slate-500 hover:text-primary transition-colors"
            @click="closeMobileMenu"
          >
            개인정보처리방침
          </NuxtLink>
          <NuxtLink
            to="/terms"
            class="text-xs text-slate-400 dark:text-slate-500 hover:text-primary transition-colors"
            @click="closeMobileMenu"
          >
            이용약관
          </NuxtLink>
        </div>
      </nav>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { CATEGORY_META, CATEGORY_GROUPS } from '~/types/facility'

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
}>()

const colorMode = useColorMode() // eslint-disable-line no-undef
const darkModeIcon = computed(() => colorMode.value === 'dark' ? 'light_mode' : 'dark_mode')

const isMobileMenuOpen = ref(false)
const activeDropdown = ref<string | null>(null)
let dropdownTimer: ReturnType<typeof setTimeout> | null = null

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

const openDropdown = (title: string) => {
  cancelCloseDropdown()
  activeDropdown.value = title
}

const scheduleCloseDropdown = () => {
  dropdownTimer = setTimeout(() => {
    activeDropdown.value = null
  }, 150)
}

const cancelCloseDropdown = () => {
  if (dropdownTimer) {
    clearTimeout(dropdownTimer)
    dropdownTimer = null
  }
}

const closeDropdown = () => {
  cancelCloseDropdown()
  activeDropdown.value = null
}

const handleBack = () => {
  emit('back')
}

const handleDarkModeToggle = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

// Escape 키로 모바일 메뉴/드롭다운 닫기
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (activeDropdown.value) {
      closeDropdown()
    } else if (isMobileMenuOpen.value) {
      closeMobileMenu()
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  cancelCloseDropdown()
})
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
