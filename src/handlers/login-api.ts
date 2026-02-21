import { createClient, ConnectError } from "@connectrpc/connect";
import { AuthService } from "@yhonda-ohishi-pub-dev/logi-proto";
import type { Env } from "../index";
import { createTransport } from "../lib/transport";
import { isAllowedRedirectUri } from "../lib/security";

export async function handleAuthLogin(
  request: Request,
  env: Env,
): Promise<Response> {
  const requestUrl = new URL(request.url);

  // Parse form body
  const formData = await request.formData();
  const organizationId = formData.get("organization_id") as string | null;
  const username = formData.get("username") as string | null;
  const password = formData.get("password") as string | null;
  const redirectUri = formData.get("redirect_uri") as string | null;

  if (!redirectUri || !isAllowedRedirectUri(redirectUri, env.ALLOWED_REDIRECT_ORIGINS)) {
    return new Response("Invalid redirect_uri", { status: 400 });
  }

  if (!username || !password) {
    return redirectToLogin(requestUrl.origin, redirectUri, "Username and password are required");
  }

  console.log(JSON.stringify({ event: "login_attempt", username, orgId: organizationId }));

  const transport = createTransport(env.GRPC_PROXY);
  const client = createClient(AuthService, transport);

  try {
    const response = await client.login({
      organizationId: organizationId || "",
      username,
      password,
    });

    // Redirect back with JWT in URL fragment
    const fragment = new URLSearchParams({
      token: response.token,
      expires_at: response.expiresAt,
    });

    // Extract org_id from JWT payload for convenience
    const payloadB64 = response.token.split(".")[1];
    if (payloadB64) {
      try {
        const payload = JSON.parse(atob(payloadB64));
        fragment.set("org_id", payload.org);
      } catch {
        // ignore decode error
      }
    }

    console.log(JSON.stringify({ event: "login_success", username, orgId: organizationId }));
    return Response.redirect(`${redirectUri}#${fragment.toString()}`, 302);
  } catch (err) {
    if (err instanceof ConnectError) {
      console.log(JSON.stringify({ event: "login_failure", username, orgId: organizationId, error: err.message }));
      return redirectToLogin(requestUrl.origin, redirectUri, err.message, organizationId || undefined);
    }
    throw err;
  }
}

function redirectToLogin(
  origin: string,
  redirectUri: string,
  error: string,
  orgId?: string,
): Response {
  const params = new URLSearchParams({
    redirect_uri: redirectUri,
    error,
  });
  if (orgId) params.set("org_id", orgId);
  return Response.redirect(`${origin}/login?${params.toString()}`, 302);
}
