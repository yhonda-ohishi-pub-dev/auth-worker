import { createClient, ConnectError } from "@connectrpc/connect";
import { AuthService } from "@yhonda-ohishi-pub-dev/logi-proto";
import type { Env } from "../index";
import { createTransport } from "../lib/transport";
import { verifyOAuthState, isAllowedRedirectUri } from "../lib/security";

export async function handleGoogleCallback(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  console.log(JSON.stringify({ event: "google_callback", hasCode: !!code, error: errorParam }));

  // User denied or Google returned error
  if (errorParam) {
    // No redirect_uri available without valid state, return plain error
    return new Response(`Google OAuth error: ${errorParam}`, { status: 400 });
  }

  if (!code || !stateParam) {
    return new Response("Missing code or state parameter", { status: 400 });
  }

  // Verify HMAC-signed state and extract redirect_uri
  const stateData = await verifyOAuthState(stateParam, env.OAUTH_STATE_SECRET);
  if (!stateData) {
    return new Response("Invalid state parameter", { status: 400 });
  }

  const { redirect_uri: redirectUri, join_org: joinOrg } = stateData;

  // Defense in depth: re-validate redirect_uri
  if (!isAllowedRedirectUri(redirectUri, env.ALLOWED_REDIRECT_ORIGINS)) {
    return new Response("Invalid redirect_uri in state", { status: 400 });
  }

  // Exchange authorization code for tokens
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.AUTH_WORKER_ORIGIN}/oauth/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error("Google token exchange failed:", errorText);
    return redirectToLogin(origin, redirectUri, "Google authentication failed");
  }

  const tokenData = (await tokenResponse.json()) as { id_token?: string };
  if (!tokenData.id_token) {
    return redirectToLogin(origin, redirectUri, "No ID token returned from Google");
  }

  // Call rust-logi LoginWithGoogle via cf-grpc-proxy
  const transport = createTransport(env.GRPC_PROXY);
  const client = createClient(AuthService, transport);

  try {
    const response = await client.loginWithGoogle({
      idToken: tokenData.id_token,
    });

    // Build JWT fragment
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

    // Join flow: redirect to /join/:slug/done with JWT fragment
    if (joinOrg) {
      const joinDoneUrl = new URL(`${origin}/join/${joinOrg}/done`);
      console.log(JSON.stringify({ event: "google_login_join", joinOrg }));
      return Response.redirect(`${joinDoneUrl.toString()}#${fragment.toString()}`, 302);
    }

    // Normal flow: redirect back to original redirect_uri
    const finalUrl = new URL(redirectUri);
    if (!finalUrl.searchParams.has('lw_callback')) {
      finalUrl.searchParams.set('lw_callback', '1');
    }
    console.log(JSON.stringify({ event: "google_login_success", redirectUri }));
    return Response.redirect(`${finalUrl.toString()}#${fragment.toString()}`, 302);
  } catch (err) {
    if (err instanceof ConnectError) {
      console.log(JSON.stringify({ event: "google_login_failure", error: err.message }));
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
