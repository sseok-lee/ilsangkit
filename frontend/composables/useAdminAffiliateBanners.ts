import type {
  AffiliateBannerDraft,
  AffiliateBannerDto,
  AffiliateBannerPage,
  AffiliateBannerPatch,
  AffiliateBannerQuery,
  UploadedAffiliateBannerImage,
} from '~/types/affiliateBanner'

type ApiEnvelope<T> = { success: boolean; data: T }

const draftKeys = [
  'provider',
  'name',
  'imageSourceType',
  'imageAssetId',
  'externalImageUrl',
  'targetUrl',
  'altText',
] as const

function normalizeImageFields<T extends AffiliateBannerDraft | AffiliateBannerPatch>(input: T): T {
  const body: Record<string, unknown> = {}
  for (const key of draftKeys) {
    if (key in input) body[key] = input[key]
  }

  if (body.imageSourceType === 'upload') {
    body.externalImageUrl = null
  }
  if (body.imageSourceType === 'url') {
    body.imageAssetId = null
  }

  return body as T
}

export function useAdminAffiliateBanners() {
  const apiBase = useApiBase()

  async function list(query: AffiliateBannerQuery): Promise<AffiliateBannerPage> {
    const params = new URLSearchParams()
    params.set('page', String(query.page))
    params.set('limit', String(query.limit))
    if (query.provider) params.set('provider', query.provider)
    if (typeof query.isEnabled === 'boolean') params.set('isEnabled', String(query.isEnabled))

    const response = await $fetch<ApiEnvelope<AffiliateBannerPage>>(
      `${apiBase}/api/admin/affiliate-banners?${params.toString()}`,
      { credentials: 'include' }
    )
    return response.data
  }

  async function get(id: string): Promise<AffiliateBannerDto> {
    const response = await $fetch<ApiEnvelope<AffiliateBannerDto>>(
      `${apiBase}/api/admin/affiliate-banners/${id}`,
      { credentials: 'include' }
    )
    return response.data
  }

  async function create(draft: AffiliateBannerDraft): Promise<AffiliateBannerDto> {
    const response = await $fetch<ApiEnvelope<AffiliateBannerDto>>(
      `${apiBase}/api/admin/affiliate-banners`,
      { method: 'POST', body: normalizeImageFields(draft), credentials: 'include' }
    )
    return response.data
  }

  async function update(id: string, patch: AffiliateBannerPatch): Promise<AffiliateBannerDto> {
    const response = await $fetch<ApiEnvelope<AffiliateBannerDto>>(
      `${apiBase}/api/admin/affiliate-banners/${id}`,
      { method: 'PATCH', body: normalizeImageFields(patch), credentials: 'include' }
    )
    return response.data
  }

  async function setStatus(id: string, isEnabled: boolean): Promise<AffiliateBannerDto> {
    const response = await $fetch<ApiEnvelope<AffiliateBannerDto>>(
      `${apiBase}/api/admin/affiliate-banners/${id}/status`,
      { method: 'PATCH', body: { isEnabled }, credentials: 'include' }
    )
    return response.data
  }

  async function uploadImage(file: File): Promise<UploadedAffiliateBannerImage> {
    const response = await $fetch<ApiEnvelope<UploadedAffiliateBannerImage>>(
      `${apiBase}/api/admin/affiliate-banner-images`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      }
    )
    return response.data
  }

  return {
    list,
    get,
    create,
    update,
    setStatus,
    uploadImage,
  }
}
