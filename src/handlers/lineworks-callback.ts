import { createClient, ConnectError } from "@connectrpc/connect";
import { AuthService } from "@yhonda-ohishi-pub-dev/logi-proto";
import type { Env } from "../index";
import { createTransport } from "../lib/transport";
import { verifyOAuthState, isAllowedRedirectUri } from "../lib/security";

export async function handleLineworksCallback(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return new Response(`LINE WORKS OAuth error: ${errorParam}`, { status: 400 });
  }

  if (!code || !stateParam) {
    return new Response("Missing code or state parameter", { status: 400 });
  }

  // Verify HMAC-signed state and extract redirect_uri + provider info
  const stateData = await verifyOAuthState(stateParam, env.OAUTH_STATE_SECRET);
  if (!stateData) {
    return new Response("Invalid state parameter", { status: 400 });
  }

  const { redirect_uri: redirectUri, provider, external_org_id: externalOrgId } = stateData;

  if (!redirectUri || !isAllowedRedirectUri(redirectUri, env.ALLOWED_REDIRECT_ORIGINS)) {
    return new Response("Invalid redirect_uri in state", { status: 400 });
  }

  if (!provider || !externalOrgId) {
    return new Response("Missing provider info in state", { status: 400 });
  }

  // Call rust-logi LoginWithSsoProvider (handles code exchange + user creation + JWT)
  const transport = createTransport(env.GRPC_PROXY);
  const client = createClient(AuthService, transport);

  try {
    const response = await client.loginWithSsoProvider({
      provider,
      externalOrgId,
      code,
      redirectUri: `${env.AUTH_WORKER_ORIGIN}/oauth/lineworks/callback`,
    });

    // Redirect back with JWT in URL fragment (same as Google flow)
    const fragment = new URLSearchParams({
      token: response.token,
      expires_at: response.expiresAt,
    });

    // Extract org_id from JWT payload
    const payloadB64 = response.token.split(".")[1];
    if (payloadB64) {
      try {
        const payload = JSON.parse(atob(payloadB64));
        fragment.set("org_id", payload.org);
      } catch {
        // ignore decode error
      }
    }

    return Response.redirect(`${redirectUri}#${fragment.toString()}`, 302);
  } catch (err) {
    if (err instanceof ConnectError) {
      return redirectToLogin(origin, redirectUri, err.message);
    }
    throw err;
  }
}

function redirectToLogin(origin: string, redirectUri: string, error: string): Response {
  const params = new URLSearchParams({
    redirect_uri: redirectUri,
    error,
  });
  return Response.redirect(`${origin}/login?${params.toString()}`, 302);
}
