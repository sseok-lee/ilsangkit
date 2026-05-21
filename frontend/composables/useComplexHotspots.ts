import { ref } from 'vue';
import type { ComplexHotspots, ComplexHotspotsByProperty } from './useHomeDashboard';
import type { RealEstatePropertyType } from '~/types/realEstate';

type ApiEnvelope = { success: boolean; data: ComplexHotspots };

export function useComplexHotspots(initial: ComplexHotspotsByProperty) {
  const data = ref<ComplexHotspotsByProperty>({ ...initial });

  async function loadProperty(propertyType: RealEstatePropertyType): Promise<void> {
    if (data.value[propertyType]) return;
    const config = useRuntimeConfig();
    const res = await $fetch<ApiEnvelope>(
      `${config.public.apiBase}/api/meta/complex-hotspots`,
      { query: { propertyType } },
    );
    if (res.success) {
      data.value = { ...data.value, [propertyType]: res.data };
    }
  }

  return { data, loadProperty };
}
