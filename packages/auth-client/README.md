# @yhonda-ohishi-pub-dev/auth-client

フロントエンド共通の認証 composable（Nuxt 3 用）。LINE WORKS 自動ログイン対応。

## インストール

```bash
# .npmrc に追加
echo "@yhonda-ohishi-pub-dev:registry=https://npm.pkg.github.com" >> .npmrc

# インストール
npm install @yhonda-ohishi-pub-dev/auth-client
```

## セットアップ

### 1. nuxt.config.ts

```typescript
export default defineNuxtConfig({
  build: {
    transpile: ['@yhonda-ohishi-pub-dev/auth-client'],
  },
  runtimeConfig: {
    public: {
      authWorkerUrl: process.env.NUXT_PUBLIC_AUTH_WORKER_URL || '',
    },
  },
})
```

### 2. composables/useAuth.ts

```typescript
export { useAuth } from '@yhonda-ohishi-pub-dev/auth-client'
export type { AuthState } from '@yhonda-ohishi-pub-dev/auth-client'
```

## API

```typescript
const {
  authState,        // Ref<AuthState | null> — JWT状態
  isAuthenticated,  // ComputedRef<boolean> — 認証済みか
  token,            // ComputedRef<string | null> — JWTトークン
  orgId,            // ComputedRef<string | null> — 組織ID
  loadFromStorage,  // () => void — localStorageから復元
  consumeFragment,  // () => boolean — URL fragment (#token=...) を解析・保存
  redirectToLogin,  // () => void — ログイン画面へリダイレクト（LWドメイン保存済みなら自動ログイン）
  logout,           // () => void — ログアウト（LWドメインもクリア）
  saveLwDomain,     // (domain: string) => void — LINE WORKSドメインを保存
  getLwDomain,      // () => string | null — 保存済みLINE WORKSドメインを取得
  clearLwDomain,    // () => void — LINE WORKSドメインをクリア
} = useAuth()
```

## LINE WORKS 自動ログイン

Bot が `?lw=<domain>` パラメータ付き URL を送信:

```
https://carins.mtamaramu.com/?lw=ohishi
```

### フロー

1. **初回**: `?lw=ohishi` → ドメインを localStorage/cookie に保存 → LINE WORKS OAuth 自動開始
2. **2回目以降**: パラメータなしでも保存済みドメインで自動ログイン
3. **ログアウト**: `clearLwDomain()` でドメイン記憶を解除 → 通常ログインページ

### plugins/auth.client.ts での使い方

```typescript
export default defineNuxtPlugin({
  name: 'auth',
  enforce: 'pre',
  setup() {
    const { consumeFragment, loadFromStorage, isAuthenticated, redirectToLogin, saveLwDomain } = useAuth()

    // ?lw=<domain> パラメータを検出して保存
    const urlParams = new URLSearchParams(window.location.search)
    const lwParam = urlParams.get('lw')
    if (lwParam) {
      saveLwDomain(lwParam)
      urlParams.delete('lw')
      history.replaceState(null, '', window.location.pathname + (urlParams.toString() ? `?${urlParams}` : ''))
    }

    // JWT復元
    const found = consumeFragment()
    if (!found) loadFromStorage()

    // 未認証 → ログイン（LWドメイン保存済みなら自動ログイン）
    if (!isAuthenticated.value) {
      redirectToLogin()
      return
    }
  },
})
```

## 使用先

- [nuxt-pwa-carins](https://github.com/yhonda-ohishi/nuxt-pwa-carins) — メインUI（carins.mtamaramu.com）
- [nuxt-dtako-logs](https://github.com/yhonda-ohishi/nuxt_dtako_logs) — DTakoログビューワー（ohishi2.mtamaramu.com）
