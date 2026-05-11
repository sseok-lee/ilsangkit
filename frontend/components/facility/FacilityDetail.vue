<template>
  <component
    v-if="component"
    :is="component"
    :details="facility.details"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FacilityDetail as FacilityDetailType } from '~/types/facility'
import { detailComponentFor } from './detailComponentRegistry'

const props = defineProps<{
  facility: FacilityDetailType
}>()

const component = computed(() => detailComponentFor(props.facility.category))
</script>
