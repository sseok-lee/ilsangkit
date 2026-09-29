import { afterEach, describe, expect, it } from 'vitest'
import releaseIdMiddleware from '../../server/middleware/release-id'

function createEvent() {
  const headers = new Map<string, string>()
  return {
    node: {
      res: {
        setHeader(name: string, value: string) {
          headers.set(name.toLowerCase(), value)
        },
      },
    },
    headers,
  }
}

describe('release id middleware', () => {
  afterEach(() => {
    delete process.env.ILSK_RELEASE_ID
  })

  it('stays inert when release id is unset', async () => {
    const event = createEvent()

    await releaseIdMiddleware(event as never)

    expect(event.headers.get('x-ilsangkit-release-id')).toBeUndefined()
  })

  it('emits the runtime release id header when enabled', async () => {
    process.env.ILSK_RELEASE_ID = 'address-20260929-abc123'
    const event = createEvent()

    await releaseIdMiddleware(event as never)

    expect(event.headers.get('x-ilsangkit-release-id')).toBe('address-20260929-abc123')
  })
})
