import { $fetch, type FetchOptions } from 'ofetch'
import { getInternalApiBase } from './internalApiBase'

export interface SsrFetchOptions<T = unknown> extends FetchOptions<'json'> {
  retries?: number
  retryDelayMs?: number
  timeoutMs?: number
}

const RETRIABLE_STATUS = new Set([502, 503, 504])
const RETRIABLE_CONNECTION_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'])

function isRetriable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = (err as { name?: string }).name
  if (name === 'AbortError') return false
  const status = (err as { status?: number; statusCode?: number }).status
              ?? (err as { statusCode?: number }).statusCode
  if (typeof status === 'number') return RETRIABLE_STATUS.has(status)
  const code = (err as { code?: string; cause?: { code?: string } }).code
            ?? (err as { cause?: { code?: string } }).cause?.code
  if (typeof code === 'string') return RETRIABLE_CONNECTION_CODES.has(code)
  return false
}

function backoffMs(attempt: number, base: number): number {
  return base * (2 ** attempt) + Math.floor(Math.random() * base)
}

export async function ssrFetch<T>(
  path: string,
  opts: SsrFetchOptions<T> = {},
): Promise<T> {
  const { retries = 2, retryDelayMs = 200, timeoutMs = 5000, ...fetchOpts } = opts
  const url = /^https?:\/\//.test(path) ? path : `${getInternalApiBase()}${path}`

  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await ($fetch as (url: string, opts: object) => Promise<T>)(url, {
        ...fetchOpts,
        signal: controller.signal,
      })
    } catch (err) {
      lastErr = err
      if (attempt === retries || !isRetriable(err)) {
        console.error(`[ssrFetch] final failure: ${url}`, err)
        throw err
      }
      console.warn(`[ssrFetch] attempt ${attempt + 1}/${retries + 1} failed: ${url}`, err)
      await new Promise(r => setTimeout(r, backoffMs(attempt, retryDelayMs)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr
}
