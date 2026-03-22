/**
 * Admin Users management page handlers
 *
 * /admin/users          — cookie 認証必須。なければ /login へリダイレクト
 * /admin/users/callback — ログイン後の着地点。fragment → cookie → /admin/users へリダイレクト
 */

import type { Env } from "../index";
import { renderAdminUsersPage } from "../lib/admin-users-html";

const COOKIE_NAME = "sso_admin_token";

function getTokenFromCookie(request: Request): string | null {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  return match ? match[1] ?? null : null;
}

/** GET /admin/users — cookie チェック → ページ配信 or ログインリダイレクト */
export async function handleAdminUsersPage(
  request: Request,
  env: Env,
): Promise<Response> {
  const token = getTokenFromCookie(request);
  if (!token) {
    const origin = new URL(request.url).origin;
    const callbackUri = `${origin}/admin/users/callback`;
    return Response.redirect(
      `${origin}/login?redirect_uri=${encodeURIComponent(callbackUri)}`,
      302,
    );
  }

  // サーバー側で権限チェック
  try {
    const resp = await fetch(`${env.ALC_API_ORIGIN}/api/admin/users`, {
      headers: { "Authorization": `Bearer ${token}` },
    });
    if (resp.status === 403) {
      return Response.redirect(`${env.AUTH_WORKER_ORIGIN}/top?error=no_permission`, 302);
    }
  } catch {
    // エラーはページを表示してクライアント側で処理
  }

  const html = renderAdminUsersPage();
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** GET /admin/users/callback — fragment から token を cookie に保存して /admin/users へ */
export async function handleAdminUsersCallback(): Promise<Response> {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Redirecting...</title></head>
<body>
<script>
  const hash = window.location.hash;
  if (hash && hash.includes('token=')) {
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get('token');
    const expiresAt = params.get('expires_at');
    if (token) {
      let maxAge = 86400;
      if (expiresAt) {
        const exp = Number(expiresAt);
        if (!isNaN(exp)) maxAge = Math.max(exp - Math.floor(Date.now() / 1000), 60);
      }
      document.cookie = '${COOKIE_NAME}=' + token + '; path=/admin; max-age=' + maxAge + '; secure; samesite=lax';
      window.location.replace('/admin/users');
    } else {
      window.location.replace('/admin/users');
    }
  } else {
    window.location.replace('/admin/users');
  }
</script>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
