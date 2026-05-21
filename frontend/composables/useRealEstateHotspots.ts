import { ref } from 'vue';
import type { RealEstateHotspots, PropertyHotspots } from './useHomeDashboard';
import type { RealEstatePropertyType } from '~/types/realEstate';

type ApiEnvelope = { success: boolean; data: PropertyHotspots };

export function useRealEstateHotspots(initial: RealEstateHotspots) {
  const data = ref<RealEstateHotspots>({ ...initial });

  async function loadProperty(propertyType: RealEstatePropertyType): Promise<void> {
    if (data.value[propertyType]) return;
    const config = useRuntimeConfig();
    const res = await $fetch<ApiEnvelope>(
      `${config.public.apiBase}/api/meta/hotspots`,
      { query: { propertyType } },
    );
    if (res.success) {
      data.value = { ...data.value, [propertyType]: res.data };
    }
  }

  return { data, loadProperty };
}
