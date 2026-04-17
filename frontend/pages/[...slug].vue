<template>
  <div />
</template>

<script setup lang="ts">
// Nuxt는 setup에서 throw된 createError를 error 레이아웃으로 전환한다.
// template은 실제로 렌더되지 않지만 Vue dev warn 방지를 위해 빈 엘리먼트 유지.
throw createError({
  statusCode: 404,
  message: '페이지를 찾을 수 없습니다',
  fatal: true,
})
</script>
