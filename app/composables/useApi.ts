import type { NitroFetchOptions, NitroFetchRequest } from 'nitropack'

/** $fetch against falco-core with the seller's token; on a 401 it renews the session once and retries. */
export function useApi() {
  const baseURL = useRuntimeConfig().public.apiBase
  const auth = useAuth()

  return async function api<T>(url: string, options: NitroFetchOptions<NitroFetchRequest> = {}): Promise<T> {
    const call = () => $fetch<T>(url, {
      ...options,
      baseURL,
      timeout: 30000,
      headers: {
        ...(options.headers as Record<string, string> | undefined),
        ...(auth.accessToken.value ? { Authorization: `Bearer ${auth.accessToken.value}` } : {})
      }
    }) as Promise<T>
    try {
      return await call()
    } catch (error) {
      if (statusOf(error) === 401 && await auth.refresh()) {
        return await call()
      }
      throw error
    }
  }
}
