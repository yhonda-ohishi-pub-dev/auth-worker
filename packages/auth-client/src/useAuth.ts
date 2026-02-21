/**
 * Auth状態管理 composable
 *
 * JWT の保存・復元・URL fragment 解析・ログインリダイレクトを担当
 * localStorage + cookie の二重保存（cookie は server-side handler 用）
 *
 * LINE WORKS 自動ログイン:
 * ?lw=<domain> パラメータでドメインを保存し、次回以降はログインページをスキップして
 * LINE WORKS OAuth を直接開始する
 */
import { computed } from 'vue'
import { useRuntimeConfig, useState } from '#imports'

const AUTH_STORAGE_KEY = 'logi_auth'
const AUTH_COOKIE_NAME = 'logi_auth_token'
const LW_DOMAIN_KEY = 'logi_lw_domain'
const LW_DOMAIN_COOKIE = 'lw_domain'

/** ホスト名から親ドメインを取得（cross-subdomain cookie 用） */
function getParentDomain(): string {
  if (typeof window === 'undefined') return ''
  const parts = window.location.hostname.split('.')
  return parts.length > 2 ? '.' + parts.slice(-2).join('.') : window.location.hostname
}

export interface AuthState {
  token: string
  orgId: string
  expiresAt: number // unix timestamp (seconds)
}

function readStorage(): AuthState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthState
  } catch {
    return null
  }
}

function writeStorage(state: AuthState): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state))

  // cookie にもトークンを保存（server-side handler + cross-subdomain 共有用）
  const now = Math.floor(Date.now() / 1000)
  const maxAge = Math.max(state.expiresAt - now, 0)
  const domain = getParentDomain()
  document.cookie = `${AUTH_COOKIE_NAME}=${state.token}; Domain=${domain}; path=/; max-age=${maxAge}; secure; samesite=lax`
}

function clearStorage(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY)
  const domain = getParentDomain()
  document.cookie = `${AUTH_COOKIE_NAME}=; Domain=${domain}; path=/; max-age=0; secure; samesite=lax`
}

/** LINE WORKS ドメインを保存（localStorage + cookie 二重保存、cross-subdomain 共有） */
function saveLwDomain(domain: string): void {
  localStorage.setItem(LW_DOMAIN_KEY, domain)
  const maxAge = 30 * 24 * 60 * 60 // 30日
  const parentDomain = getParentDomain()
  document.cookie = `${LW_DOMAIN_COOKIE}=${encodeURIComponent(domain)}; Domain=${parentDomain}; path=/; max-age=${maxAge}; secure; samesite=lax`
}

/** LINE WORKS ドメインを取得 */
function getLwDomain(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(LW_DOMAIN_KEY)
}

/** LINE WORKS ドメインをクリア（明示的ログアウト時） */
function clearLwDomain(): void {
  localStorage.removeItem(LW_DOMAIN_KEY)
  const parentDomain = getParentDomain()
  document.cookie = `${LW_DOMAIN_COOKIE}=; Domain=${parentDomain}; path=/; max-age=0; secure; samesite=lax`
}

export const useAuth = () => {
  const config = useRuntimeConfig()
  const authWorkerUrl = config.public.authWorkerUrl as string

  // Global reactive state (shared across all composable calls via key 'auth')
  const authState = useState<AuthState | null>('auth', () => null)

  /** localStorage からトークンを復元。期限切れなら破棄。 */
  function loadFromStorage(): void {
    const stored = readStorage()
    if (stored) {
      const now = Math.floor(Date.now() / 1000)
      if (stored.expiresAt > now) {
        authState.value = stored
      } else {
        clearStorage()
        authState.value = null
      }
    }
  }

  /**
   * auth-worker リダイレクト後の URL fragment を解析・保存。
   * Fragment: #token=<jwt>&org_id=<uuid>&expires_at=<RFC3339>
   * @returns true if token was found and stored
   */
  function consumeFragment(): boolean {
    if (typeof window === 'undefined') return false
    const hash = window.location.hash
    if (!hash || !hash.includes('token=')) return false

    const params = new URLSearchParams(hash.slice(1))
    const token = params.get('token')
    const orgId = params.get('org_id')
    const expiresAtStr = params.get('expires_at')

    if (!token || !orgId) return false

    // expires_at: RFC3339 string or unix timestamp
    let expiresAt: number
    if (expiresAtStr) {
      const asNum = Number(expiresAtStr)
      if (!isNaN(asNum) && expiresAtStr.length >= 10) {
        expiresAt = asNum
      } else {
        const parsed = new Date(expiresAtStr).getTime()
        expiresAt = isNaN(parsed) ? Math.floor(Date.now() / 1000) + 86400 : Math.floor(parsed / 1000)
      }
    } else {
      expiresAt = Math.floor(Date.now() / 1000) + 86400
    }

    const state: AuthState = { token, orgId, expiresAt }
    writeStorage(state)
    authState.value = state

    // Clean fragment from URL without reload
    history.replaceState(null, '', window.location.pathname + window.location.search)
    return true
  }

  /**
   * Cookie から認証状態を復旧（cross-subdomain 共有用）
   * トップページや他アプリで認証済みの場合、.mtamaramu.com cookie から JWT を復元
   * @returns true if token was recovered from cookie
   */
  function recoverFromCookie(): boolean {
    if (typeof window === 'undefined') return false
    const tokenCookie = document.cookie.split('; ').find(c => c.startsWith(AUTH_COOKIE_NAME + '='))
    if (!tokenCookie) return false
    const token = tokenCookie.split('=').slice(1).join('=')
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp <= now) return false
      const state: AuthState = { token, orgId: payload.org, expiresAt: payload.exp }
      authState.value = state
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state))
      // lw_domain cookie → localStorage 同期
      const lwCookie = document.cookie.split('; ').find(c => c.startsWith(LW_DOMAIN_COOKIE + '='))
      if (lwCookie) {
        const domain = decodeURIComponent(lwCookie.split('=')[1] || '')
        if (domain) saveLwDomain(domain)
      }
      return true
    } catch {
      return false
    }
  }

  /**
   * auth-worker ログイン画面へリダイレクト
   * LINE WORKS ドメインが保存済みなら OAuth を直接開始（ログインページスキップ）
   */
  function redirectToLogin(): void {
    if (!authWorkerUrl) {
      console.error('[Auth] authWorkerUrl is not configured')
      return
    }
    const redirectUri = window.location.origin + '/?lw_callback=1'

    // LINE WORKS 自動ログイン（ドメイン保存済みの場合）
    const lwDomain = getLwDomain()
    if (lwDomain) {
      const params = new URLSearchParams({
        address: lwDomain,
        redirect_uri: redirectUri,
      })
      window.location.href = `${authWorkerUrl}/oauth/lineworks/redirect?${params.toString()}`
      return
    }

    // デフォルト: 汎用ログイン画面
    window.location.href = `${authWorkerUrl}/login?redirect_uri=${encodeURIComponent(redirectUri)}`
  }

  /** ログアウト: ストレージ/cookie クリア → ログイン画面 */
  function logout(): void {
    clearStorage()
    clearLwDomain()
    authState.value = null
    if (!authWorkerUrl) return
    const redirectUri = window.location.origin + '/?lw_callback=1'
    window.location.href = `${authWorkerUrl}/login?redirect_uri=${encodeURIComponent(redirectUri)}`
  }

  /** LINE WORKS 自動ログイン URL を生成 */
  function getLwLoginUrl(): string | null {
    if (typeof window === 'undefined') return null
    const lwDomain = getLwDomain()
    if (!lwDomain) return null
    return `${window.location.origin}/?lw=${encodeURIComponent(lwDomain)}`
  }

  /** LINE WORKS 自動ログイン URL をクリップボードにコピー */
  async function copyLwLoginUrl(): Promise<boolean> {
    const url = getLwLoginUrl()
    if (!url) return false
    try {
      await navigator.clipboard.writeText(url)
      return true
    } catch {
      return false
    }
  }

  /** auth-worker の設定ページ URL を取得 */
  function getSettingsUrl(): string {
    return `${authWorkerUrl}/admin/sso`
  }

  const isAuthenticated = computed(() => {
    if (!authState.value) return false
    const now = Math.floor(Date.now() / 1000)
    return authState.value.expiresAt > now
  })

  const token = computed(() => authState.value?.token ?? null)
  const orgId = computed(() => authState.value?.orgId ?? null)

  return {
    authState,
    isAuthenticated,
    token,
    orgId,
    loadFromStorage,
    recoverFromCookie,
    consumeFragment,
    redirectToLogin,
    logout,
    saveLwDomain,
    getLwDomain,
    clearLwDomain,
    getLwLoginUrl,
    copyLwLoginUrl,
    getSettingsUrl,
  }
}
