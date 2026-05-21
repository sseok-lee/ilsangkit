// Stub for Nuxt's #imports virtual module — used by vitest alias resolution.
// vi.mock('#imports', ...) in individual tests overrides this at runtime.
export const useRuntimeConfig = () => ({
  public: { apiBase: '' },
})
