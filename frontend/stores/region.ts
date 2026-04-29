import { defineStore } from 'pinia'

const STORAGE_KEY = 'ilsangkit_user_region'

export interface UserRegionState {
  citySlug: string | null
  districtSlug: string | null
  dong: string | null
  setAt: number
}

const DEFAULT_STATE: UserRegionState = {
  citySlug: null,
  districtSlug: null,
  dong: null,
  setAt: 0,
}

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export const useRegionStore = defineStore('region', {
  state: (): UserRegionState => ({ ...DEFAULT_STATE }),

  getters: {
    isSet: (s): boolean => Boolean(s.citySlug && s.districtSlug),
    radiusMeters: (s): number => (s.dong ? 1500 : 5000),
    label: (s): string => {
      if (!s.districtSlug) return ''
      return s.dong ? `${s.districtSlug} ${s.dong}` : s.districtSlug
    },
  },

  actions: {
    hydrateFromStorage() {
      if (!isClient()) return
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          this.citySlug = typeof parsed.citySlug === 'string' ? parsed.citySlug : null
          this.districtSlug = typeof parsed.districtSlug === 'string' ? parsed.districtSlug : null
          this.dong = typeof parsed.dong === 'string' ? parsed.dong : null
          this.setAt = typeof parsed.setAt === 'number' ? parsed.setAt : 0
        }
      } catch {
        // 손상된 값 무시
      }
    },

    setRegion(input: { citySlug: string; districtSlug: string; dong?: string | null }) {
      this.citySlug = input.citySlug
      this.districtSlug = input.districtSlug
      this.dong = input.dong ?? null
      this.setAt = Date.now()
      this.persist()
    },

    clearRegion() {
      this.$patch({ ...DEFAULT_STATE })
      if (isClient()) {
        try {
          window.localStorage.removeItem(STORAGE_KEY)
        } catch {
          // 무시
        }
      }
    },

    persist() {
      if (!isClient()) return
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state))
      } catch {
        // 저장 실패 무시 (사파리 사적 모드 등)
      }
    },
  },
})
