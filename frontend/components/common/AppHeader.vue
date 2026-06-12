<template>
  <header
    :class="[
      'sticky top-0 z-50 px-4 md:px-6 h-14 md:h-16',
      'bg-background-light',
      'border-b border-transparent',
      'transition-colors duration-300',
      props.transparent ? 'bg-transparent border-transparent' : ''
    ]"
  >
    <div class="mx-auto flex h-full w-full max-w-[1200px] items-center">
      <!-- Left: Back Button (if enabled) or Logo -->
      <div class="flex items-center gap-2">
        <button
          v-if="props.showBackButton"
          class="flex size-11 items-center justify-center rounded-full hover:bg-black/5 transition-colors text-strong"
          aria-label="뒤로가기"
          @click="handleBack"
        >
          <span class="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>

        <HardLink v-if="!props.showBackButton" to="/" class="flex items-center">
          <img src="/icons/logo.webp" alt="일상킷" class="h-9 md:h-12 w-auto shrink-0" width="91" height="36" />
        </HardLink>
      </div>

      <!-- Center/Right: Desktop Navigation (single nav, fills remaining width) -->
      <nav class="hidden md:flex items-center flex-1 gap-1 ml-4">
        <!-- 좌측 로고와 우측 정렬 네비 클러스터 사이 여백 -->
        <div class="flex-1" aria-hidden="true"></div>
        <!-- 개별 드롭다운: NAV_LINK_GROUPS (부동산, 청약·임대) -->
        <div
          v-for="group in NAV_LINK_GROUPS"
          :key="group.title"
          data-testid="nav-group"
          class="relative"
          @mouseenter="openDropdown(group.title)"
          @mouseleave="scheduleCloseDropdown"
          @focusout="handleDropdownFocusout($event, group.title)"
        >
          <button
            class="flex items-center gap-1.5 px-3 py-2 text-base font-medium text-muted hover:text-primary rounded-lg hover:bg-background-light transition-colors"
            aria-haspopup="true"
            :aria-expanded="activeDropdown === group.title"
            @click="toggleDropdown(group.title)"
            @keydown.enter.prevent="openDropdown(group.title)"
            @keydown.space.prevent="openDropdown(group.title)"
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
              class="absolute top-full left-0 mt-1 min-w-[180px] bg-white rounded-xl shadow-lg border border-line-2 p-2 z-50"
              @mouseenter="cancelCloseDropdown"
              @mouseleave="scheduleCloseDropdown"
            >
              <template v-for="(link, idx) in group.links" :key="link.to">
                <!-- 섹션 시작점에 헤딩 표시 -->
                <template v-if="link.section && (idx === 0 || link.section !== group.links[idx - 1].section)">
                  <div
                    v-if="idx > 0"
                    data-testid="nav-section-divider"
                    class="h-px bg-line my-1 mx-2"
                  />
                  <div
                    data-testid="nav-section-heading"
                    class="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint"
                  >
                    {{ link.section }}
                  </div>
                </template>
                <HardLink
                  :to="link.to"
                  class="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-background-light text-[15px] text-ink transition-colors"
                  @click="closeDropdown"
                >
                  <img v-if="link.iconImg" :src="`/icons/category/${link.iconImg}.webp?v2`" :alt="link.label" class="w-5 h-5" width="20" height="20" />
                  <span v-else class="material-symbols-outlined text-[18px] text-faint">{{ link.icon }}</span>
                  {{ link.label }}
                </HardLink>
              </template>
            </div>
          </Transition>
        </div>

        <!-- 생활시설: 시설 4개 그룹 통합 메가메뉴 -->
        <div
          data-testid="nav-group"
          class="relative"
          @mouseenter="openDropdown('생활시설')"
          @mouseleave="scheduleCloseDropdown"
          @focusout="handleDropdownFocusout($event, '생활시설')"
        >
          <button
            class="flex items-center gap-1.5 px-3 py-2 text-base font-medium text-muted hover:text-primary rounded-lg hover:bg-background-light transition-colors"
            aria-haspopup="true"
            :aria-expanded="activeDropdown === '생활시설'"
            @click="toggleDropdown('생활시설')"
            @keydown.enter.prevent="openDropdown('생활시설')"
            @keydown.space.prevent="openDropdown('생활시설')"
          >
            <span class="material-symbols-outlined text-[18px]">grid_view</span>
            생활시설
            <span class="material-symbols-outlined text-[16px] transition-transform" :class="{ 'rotate-180': activeDropdown === '생활시설' }">expand_more</span>
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
              v-if="activeDropdown === '생활시설'"
              data-testid="nav-mega-menu"
              role="region"
              aria-label="생활시설 메뉴"
              class="absolute top-full right-0 mt-1 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 w-[360px] lg:w-[640px] max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-lg border border-line-2 p-4 z-50"
              @mouseenter="cancelCloseDropdown"
              @mouseleave="scheduleCloseDropdown"
            >
              <div v-for="group in CATEGORY_GROUPS" :key="group.title">
                <div class="flex items-center gap-1.5 px-2 pb-1.5 mb-1 border-b border-line text-[13px] font-bold text-strong">
                  <span class="material-symbols-outlined text-[18px] text-primary">{{ group.icon }}</span>
                  {{ group.title }}
                </div>
                <HardLink
                  v-for="catId in group.categories"
                  :key="catId"
                  :to="`/${catId}`"
                  class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-light text-[15px] text-ink transition-colors"
                  @click="closeDropdown"
                >
                  <CategoryIcon :category-id="catId" size="sm" />
                  {{ CATEGORY_META[catId].shortLabel }}
                </HardLink>
              </div>
            </div>
          </Transition>
        </div>

        <!-- 통합 검색창 (메가메뉴와 유틸리티 링크 사이 자체 영역) -->
        <HeaderSearch variant="desktop" v-show="showHeaderSearch" class="w-48 lg:w-56" />

        <!-- Utility Links (우측 정렬 클러스터 내부) -->
        <div class="flex items-center gap-1">
          <div class="h-5 w-px bg-line-2 mx-1"></div>
          <HardLink
            to="/guide"
            class="flex items-center gap-1.5 px-3 py-2 text-base font-medium text-muted hover:text-primary rounded-lg hover:bg-background-light transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">menu_book</span>
            가이드
          </HardLink>
          <HardLink
            to="/about"
            class="flex items-center gap-1.5 px-3 py-2 text-base font-medium text-muted hover:text-primary rounded-lg hover:bg-background-light transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">info</span>
            소개
          </HardLink>
        </div>
      </nav>

      <!-- Mobile Cluster: 검색 + 메뉴 (우측 정렬) -->
      <div class="md:hidden ml-auto flex items-center gap-0.5">
        <HeaderSearch variant="mobile" v-show="showHeaderSearch" />
        <button
          class="flex size-11 cursor-pointer items-center justify-center overflow-hidden rounded-full hover:bg-black/5 transition-colors text-strong"
          aria-label="메뉴"
          :aria-expanded="isMobileMenuOpen"
          @click="toggleMobileMenu($event)"
        >
          <span class="material-symbols-outlined text-[28px]">menu</span>
        </button>
      </div>
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
      ref="mobileMenuRef"
      data-testid="mobile-menu"
      role="navigation"
      aria-label="모바일 메뉴"
      class="md:hidden fixed top-[56px] left-0 right-0 bottom-0 z-40 bg-background-light border-b border-line-2 shadow-lg overflow-y-auto"
      @keydown.tab="handleMobileMenuTab"
    >
      <nav class="flex flex-col p-4 gap-1">
        <!-- 부동산 / 청약·임대 (link groups) -->
        <div v-for="group in NAV_LINK_GROUPS" :key="group.title" class="mb-1">
          <div class="px-4 py-2 flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider">
            <span class="material-symbols-outlined text-[16px] text-primary">{{ group.icon }}</span>
            {{ group.title }}
          </div>
          <template v-for="(link, idx) in group.links" :key="link.to">
            <div
              v-if="link.section && (idx === 0 || link.section !== group.links[idx - 1].section)"
              class="px-6 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint"
            >
              {{ link.section }}
            </div>
            <HardLink
              :to="link.to"
              class="pl-6 pr-4 py-2.5 text-strong hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
              @click="closeMobileMenu"
            >
              <img v-if="link.iconImg" :src="`/icons/category/${link.iconImg}.webp?v2`" :alt="link.label" class="w-5 h-5" width="20" height="20" />
              <span v-else class="material-symbols-outlined text-[18px] text-faint">{{ link.icon }}</span>
              {{ link.label }}
            </HardLink>
          </template>
        </div>

        <!-- 생활시설 통합 섹션 (시설 4개 그룹) -->
        <div class="mb-1">
          <div class="px-4 py-2 flex items-center gap-2 text-xs font-bold text-muted uppercase tracking-wider">
            <span class="material-symbols-outlined text-[16px] text-primary">grid_view</span>
            생활시설
          </div>
          <div v-for="group in CATEGORY_GROUPS" :key="group.title">
            <div class="px-6 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
              {{ group.title }}
            </div>
            <HardLink
              v-for="catId in group.categories"
              :key="catId"
              :to="`/${catId}`"
              class="pl-6 pr-4 py-2.5 text-strong hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
              @click="closeMobileMenu"
            >
              <CategoryIcon :category-id="catId" size="sm" />
              {{ CATEGORY_META[catId].shortLabel }}
            </HardLink>
          </div>
        </div>

        <div class="h-px bg-line-2 my-2"></div>
        <HardLink
          to="/"
          class="px-4 py-3 text-strong hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium"
          @click="closeMobileMenu"
        >
          홈
        </HardLink>
        <HardLink
          to="/search"
          class="px-4 py-3 text-strong hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium"
          @click="closeMobileMenu"
        >
          검색
        </HardLink>
        <HardLink
          to="/guide"
          class="px-4 py-3 text-strong hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium"
          @click="closeMobileMenu"
        >
          가이드
        </HardLink>
        <HardLink
          to="/about"
          class="px-4 py-3 text-strong hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium"
          @click="closeMobileMenu"
        >
          소개
        </HardLink>
        <div class="h-px bg-line-2 my-2"></div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2">
          <HardLink
            to="/privacy"
            class="text-xs text-muted hover:text-primary transition-colors"
            @click="closeMobileMenu"
          >
            개인정보처리방침
          </HardLink>
          <HardLink
            to="/terms"
            class="text-xs text-muted hover:text-primary transition-colors"
            @click="closeMobileMenu"
          >
            이용약관
          </HardLink>
        </div>
      </nav>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import { CATEGORY_META, NAV_LINK_GROUPS, CATEGORY_GROUPS } from '~/types/facility'
import CategoryIcon from '~/components/common/CategoryIcon.vue'
import HeaderSearch from '~/components/common/HeaderSearch.vue'

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

const isMobileMenuOpen = ref(false)
const activeDropdown = ref<string | null>(null)
const mobileMenuRef = ref<HTMLElement | null>(null)
const mobileMenuTriggerRef = ref<HTMLElement | null>(null)
let dropdownTimer: ReturnType<typeof setTimeout> | null = null

const route = useRoute()
const heroOut = ref(false) // 메인에서 히어로가 화면 밖으로 나갔는지

// 메인이 아니면 항상 표시, 메인이면 heroOut일 때만 표시
const showHeaderSearch = computed(() => route.path !== '/' || heroOut.value)

let headerScrollHandler: (() => void) | null = null

const toggleMobileMenu = (event?: Event) => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  if (event) {
    mobileMenuTriggerRef.value = event.currentTarget as HTMLElement
  }
}

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

// Focus trap for mobile menu
watch(isMobileMenuOpen, async (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    document.body.setAttribute('aria-hidden', 'true')
    await nextTick()
    const firstFocusable = mobileMenuRef.value?.querySelector<HTMLElement>('a, button')
    firstFocusable?.focus()
  } else {
    document.body.removeAttribute('aria-hidden')
    mobileMenuTriggerRef.value?.focus()
  }
})

const handleMobileMenuTab = (event: KeyboardEvent) => {
  if (!mobileMenuRef.value) return
  const focusables = mobileMenuRef.value.querySelectorAll<HTMLElement>('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

const toggleDropdown = (title: string) => {
  if (activeDropdown.value === title) {
    closeDropdown()
  } else {
    openDropdown(title)
  }
}

const handleDropdownFocusout = (event: FocusEvent, title: string) => {
  const container = (event.currentTarget as HTMLElement)
  if (!container.contains(event.relatedTarget as Node)) {
    if (activeDropdown.value === title) {
      activeDropdown.value = null
    }
  }
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
  if (!import.meta.client) return
  if (route.path === '/') {
    headerScrollHandler = () => { heroOut.value = window.scrollY > 360 }
    window.addEventListener('scroll', headerScrollHandler, { passive: true })
    headerScrollHandler()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  cancelCloseDropdown()
  if (headerScrollHandler) window.removeEventListener('scroll', headerScrollHandler)
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
