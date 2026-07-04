export function useAdminAuth() {
  const apiBase = useApiBase()

  async function login(password: string): Promise<void> {
    await $fetch(`${apiBase}/api/admin/login`, { method: 'POST', body: { password }, credentials: 'include' })
  }

  async function logout(): Promise<void> {
    await $fetch(`${apiBase}/api/admin/logout`, { method: 'POST', credentials: 'include' }).catch(() => {})
  }

  async function checkSession(): Promise<boolean> {
    try {
      await $fetch(`${apiBase}/api/admin/session`, { credentials: 'include' })
      return true
    } catch {
      return false
    }
  }

  return { login, logout, checkSession }
}
