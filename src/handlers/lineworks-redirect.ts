import { createClient, ConnectError } from "@connectrpc/connect";
import { AuthService } from "@yhonda-ohishi-pub-dev/logi-proto";
import type { Env } from "../index";
import { createTransport } from "../lib/transport";
import { isAllowedRedirectUri, generateOAuthState } from "../lib/security";

export async function handleLineworksRedirect(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri");
  const address = url.searchParams.get("address");

  if (!redirectUri || !isAllowedRedirectUri(redirectUri, env.ALLOWED_REDIRECT_ORIGINS)) {
    return new Response("Invalid or missing redirect_uri", { status: 400 });
  }

  if (!address) {
    return new Response("Missing address parameter", { status: 400 });
  }

  // Extract domain from LINE WORKS address (e.g., "tanaka@ohishi" → "ohishi")
  const domain = address.includes("@") ? address.split("@")[1] : address;
  if (!domain) {
    return new Response("Invalid LINE WORKS address", { status: 400 });
  }

  console.log(JSON.stringify({ event: "lw_redirect", domain, redirectUri }));

  // Resolve SSO provider config from rust-logi
  const transport = createTransport(env.GRPC_PROXY);
  const client = createClient(AuthService, transport);

  try {
    const config = await client.resolveSsoProvider({
      provider: "lineworks",
      externalOrgId: domain,
    });

    if (!config.available) {
      console.log(JSON.stringify({ event: "lw_not_configured", domain }));
      const params = new URLSearchParams({
        redirect_uri: redirectUri,
        error: `LINE WORKS login is not configured for "${domain}"`,
      });
      return Response.redirect(`${url.origin}/login?${params.toString()}`, 302);
    }

    console.log(JSON.stringify({ event: "lw_oauth_start", domain, clientId: config.clientId }));

    // Generate HMAC-signed state with provider info
    const state = await generateOAuthState(redirectUri, env.OAUTH_STATE_SECRET, {
      provider: "lineworks",
      external_org_id: domain,
    });

    // Build LINE WORKS authorize URL
    const authorizeUrl = new URL("https://auth.worksmobile.com/oauth2/v2.0/authorize");
    authorizeUrl.searchParams.set("client_id", config.clientId);
    authorizeUrl.searchParams.set(
      "redirect_uri",
      `${env.AUTH_WORKER_ORIGIN}/oauth/lineworks/callback`,
    );
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", "user.profile.read");
    authorizeUrl.searchParams.set("state", state);

    return Response.redirect(authorizeUrl.toString(), 302);
  } catch (err) {
    if (err instanceof ConnectError) {
      console.log(JSON.stringify({ event: "lw_redirect_error", domain, error: err.message }));
      const params = new URLSearchParams({
        redirect_uri: redirectUri,
        error: err.message,
      });
      return Response.redirect(`${url.origin}/login?${params.toString()}`, 302);
    }
    throw err;
  }
}
