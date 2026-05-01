/**
 * Admin SSO settings page handlers
 *
 * /admin/sso          — 静的 HTML 配信（認証は JS 側で sessionStorage チェック）
 * /admin/sso/callback — ログイン後の着地点。fragment → sessionStorage → /admin/sso へリダイレクト
 */

import type { Env } from "../index";
import { renderAdminSsoPage } from "../lib/admin-html";
import { getAllowedOrigins } from "../lib/config";

/** GET /admin/sso — 常に HTML を返す（認証チェックは JS 側） */
export async function handleAdminSsoPage(
  request: Request,
  env: Env,
): Promise<Response> {
  // KV allowlist (origins:<env> ∪ origins:dev) からフロントエンド URL を抽出（auth-worker 自身を除外）
  const allOrigins = (await getAllowedOrigins(env))
    .split(",")
    .map((s: string) => s.trim())
    .filter((s: string) => s);
  const frontendOrigins = allOrigins.filter(
    (s: string) => s !== env.AUTH_WORKER_ORIGIN,
  );

  // ?from=<origin> を allowlist で完全一致検証してから戻るボタン href に使う（オープンリダイレクト防止）
  const url = new URL(request.url);
  const fromParam = url.searchParams.get("from") ?? "";
  const backUrl = allOrigins.includes(fromParam) ? fromParam : "/top";

  const html = renderAdminSsoPage(frontendOrigins, backUrl);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** GET /admin/sso/callback — fragment から token を sessionStorage に保存して /admin/sso へ */
export async function handleAdminSsoCallback(): Promise<Response> {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Redirecting...</title></head>
<body>
<script>
  const hash = window.location.hash;
  if (hash && hash.includes('token=')) {
    const params = new URLSearchParams(hash.slice(1));
    const token = params.get('token');
    if (token) {
      sessionStorage.setItem('auth_token', token);
      window.location.replace('/admin/sso');
    } else {
      window.location.replace('/admin/sso');
    }
  } else {
    window.location.replace('/admin/sso');
  }
</script>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
