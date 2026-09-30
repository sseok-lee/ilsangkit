import { defineEventHandler, setResponseHeader } from 'h3'

export default defineEventHandler((event) => {
  const releaseId = process.env.ILSK_RELEASE_ID?.trim()
  if (releaseId) setResponseHeader(event, 'X-Ilsangkit-Release-Id', releaseId)
})
