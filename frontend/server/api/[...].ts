import { defineEventHandler, proxyRequest } from 'h3'
import { getInternalApiBase } from '../utils/internalApiBase'

// Resolve at request time: deployment assigns each release its own API port.
// Relative SSR $fetch calls must use the same backend as direct API calls.
export default defineEventHandler((event) => {
  return proxyRequest(event, `${getInternalApiBase()}${event.path}`)
})
