/**
 * Cookie helpers for logi_auth_token
 */

export const AUTH_COOKIE = "logi_auth_token";

/** Set-Cookie header value for auth token (24h, same-host only) */
export function setAuthCookie(token: string): string {
  return `${AUTH_COOKIE}=${token}; Path=/; Max-Age=86400; Secure; SameSite=Lax`;
}

/** Set-Cookie header value to clear auth token */
export function clearAuthCookie(): string {
  return `${AUTH_COOKIE}=; Path=/; Max-Age=0; Secure; SameSite=Lax`;
}

/** Extract auth token from request Cookie header */
export function getAuthCookie(request: Request): string | null {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/logi_auth_token=([^;]+)/);
  return match?.[1] ?? null;
}
