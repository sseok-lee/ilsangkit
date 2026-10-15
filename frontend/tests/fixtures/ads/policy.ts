// Fixture-only policy: real browser automation signals stay intact.
import { computed } from 'vue'
import { isAdFreePath } from '../../../composables/useAdsPolicy'
export { isAdFreePath }
export function canLoadAdScript() {
  return useRuntimeConfig().public.adsEnabled !== false && !isAdFreePath(useRoute().path)
}
export function useAdsPolicy() {
  const route = useRoute()
  const suppressed = useState('ads:suppressed', () => false)
  return { shouldServeAds: computed(() => !suppressed.value && !isAdFreePath(route.path)) }
}
