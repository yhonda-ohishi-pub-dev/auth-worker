import type { Env } from "../index";
import { isAllowedRedirectUri } from "../lib/security";
import { renderLoginPage } from "../lib/html";

export async function handleLoginPage(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri");
  const orgId = url.searchParams.get("org_id") || undefined;
  const error = url.searchParams.get("error") || undefined;

  if (!redirectUri || !isAllowedRedirectUri(redirectUri, env.ALLOWED_REDIRECT_ORIGINS)) {
    return new Response("Invalid or missing redirect_uri", { status: 400 });
  }

  const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID);
  const googleRedirectUrl = googleEnabled
    ? `/oauth/google/redirect?redirect_uri=${encodeURIComponent(redirectUri)}`
    : "";

  console.log(JSON.stringify({ event: "login_page", redirectUri, orgId, error }));

  const html = renderLoginPage({
    redirectUri,
    orgId,
    error,
    googleEnabled,
    googleRedirectUrl,
    lineworksRedirectUrl: "/oauth/lineworks/redirect",
  });

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
