<template>
  <a :href="to"><slot /></a>
</template>

<script setup lang="ts">
defineOptions({
  name: 'HardLink',
})

defineProps<{
  to: string
}>()
</script>
