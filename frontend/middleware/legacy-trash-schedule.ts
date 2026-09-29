import { cleanScheduleFromRoute, parseLegacySchedule, sanitizeLegacyTrashFrom } from '~/utils/trashReturnContext'

function statusFromError(error: unknown): number {
  const status = (error as { statusCode?: number; status?: number; response?: { status?: number } })
  return status.statusCode || status.status || status.response?.status || 503
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (!Object.prototype.hasOwnProperty.call(to.query, 'schedule')) return
  if (to.params.category !== 'trash') return

  const scheduleId = parseLegacySchedule(to.query.schedule)
  if (!scheduleId) {
    throw createError({ statusCode: 400, statusMessage: '잘못된 배출 일정 주소입니다' })
  }

  try {
    await $fetch<{ success: boolean; data: unknown }>(`${useApiBase()}/api/waste-schedules/${scheduleId}`)
  } catch (error) {
    const status = statusFromError(error)
    if (status === 410) throw createError({ statusCode: 410, statusMessage: '종료된 배출 일정입니다' })
    if (status === 404 || status === 422) throw createError({ statusCode: 404, statusMessage: '배출 정보를 찾을 수 없습니다' })
    throw createError({ statusCode: 503, statusMessage: '배출 정보를 확인하지 못했습니다' })
  }

  const from = sanitizeLegacyTrashFrom(cleanScheduleFromRoute(to))
  const hash = from ? `#from=${encodeURIComponent(from)}` : ''
  return navigateTo(`/trash/${scheduleId}${hash}`, {
    redirectCode: import.meta.server ? 302 : undefined,
    replace: import.meta.client,
  })
})
