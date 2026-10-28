import type { Session, TenantSelection, TokenResponse } from '~/types/pos'

const ACCESS_KEY = 'falco_pos_access_token'
const REFRESH_KEY = 'falco_pos_refresh_token'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value) {
      localStorage.setItem(key, value)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    // Private mode: the session lasts while the app is open
  }
}

function decode(token: string): Session | null {
  try {
    const payload = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload), c => c.charCodeAt(0))))
    return { userId: claims.sub, name: claims.name ?? claims.upn, roles: claims.groups ?? [], tenantId: claims.tenant_id ?? null, expiresAt: claims.exp }
  } catch {
    return null
  }
}

let refreshing: Promise<boolean> | null = null

/**
 * The seller's session. The tokens stay on the device (localStorage): without internet the POS keeps
 * selling with an expired access token, and when it comes back the refresh token (7 days) renews it.
 */
export function useAuth() {
  const apiBase = useRuntimeConfig().public.apiBase
  const accessToken = useState<string | null>('pos-access-token', () => read(ACCESS_KEY))
  const refreshToken = useState<string | null>('pos-refresh-token', () => read(REFRESH_KEY))
  const session = computed(() => accessToken.value ? decode(accessToken.value) : null)
  /** Signed in on this device, even if the access token expired while offline. */
  const signedIn = computed(() => !!refreshToken.value && !!session.value)

  function store(tokens: TokenResponse) {
    accessToken.value = tokens.accessToken
    refreshToken.value = tokens.refreshToken
    write(ACCESS_KEY, tokens.accessToken)
    write(REFRESH_KEY, tokens.refreshToken)
  }

  function clear() {
    accessToken.value = null
    refreshToken.value = null
    write(ACCESS_KEY, null)
    write(REFRESH_KEY, null)
  }

  /** Opens the session, or returns the companies to choose from when the person works in several. */
  async function login(username: string, password: string): Promise<TenantSelection | null> {
    const tokens = await $fetch<TokenResponse>('/auth/login', { baseURL: apiBase, method: 'POST', body: { email: username, password } })
    if (tokens.tenantSelection) {
      return tokens.tenantSelection
    }
    store(tokens)
    return null
  }

  async function selectTenant(selectionToken: string, tenantId: string) {
    store(await $fetch<TokenResponse>('/auth/select-tenant', { baseURL: apiBase, method: 'POST', body: { selectionToken, tenantId } }))
  }

  /**
   * A new access token. Concurrent callers share one request (the backend rotates refresh tokens and
   * treats a reused one as stolen). Without internet the session is kept; only when Falco rejects the
   * refresh token is it closed.
   */
  function refresh(): Promise<boolean> {
    if (!refreshToken.value) {
      return Promise.resolve(false)
    }
    refreshing ??= $fetch<TokenResponse>('/auth/refresh', { baseURL: apiBase, method: 'POST', body: { refreshToken: refreshToken.value } })
      .then((tokens) => {
        store(tokens)
        return true
      })
      .catch((error) => {
        if (statusOf(error)) {
          clear()
        }
        return false
      })
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  async function logout() {
    if (refreshToken.value) {
      await $fetch('/auth/logout', { baseURL: apiBase, method: 'POST', body: { refreshToken: refreshToken.value } }).catch(() => {})
    }
    clear()
  }

  return { accessToken, refreshToken, session, signedIn, login, selectTenant, refresh, logout, clear }
}
