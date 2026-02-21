import { createClient, ConnectError } from "@connectrpc/connect";
import { AuthService } from "@yhonda-ohishi-pub-dev/logi-proto";
import type { Env } from "../index";
import { createTransport } from "../lib/transport";
import { isAllowedRedirectUri } from "../lib/security";

interface WoffAuthRequest {
  accessToken: string;
  domainId: string;
  redirectUri: string;
}

export async function handleWoffAuth(
  request: Request,
  env: Env,
): Promise<Response> {
  let body: WoffAuthRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid JSON body");
  }

  const { accessToken, domainId, redirectUri } = body;

  if (!accessToken || !domainId) {
    return jsonError(400, "accessToken and domainId are required");
  }

  if (!redirectUri || !isAllowedRedirectUri(redirectUri, env.ALLOWED_REDIRECT_ORIGINS)) {
    return jsonError(400, "Invalid or missing redirect_uri");
  }

  console.log(JSON.stringify({ event: "woff_auth", domainId }));

  const transport = createTransport(env.GRPC_PROXY);
  const client = createClient(AuthService, transport);

  try {
    const response = await client.loginWithSsoProvider({
      provider: "lineworks",
      externalOrgId: domainId,
      code: "",
      redirectUri: "",
      accessToken,
    });

    // Extract org_id from JWT payload
    let orgId = "";
    const payloadB64 = response.token.split(".")[1];
    if (payloadB64) {
      try {
        const payload = JSON.parse(atob(payloadB64));
        orgId = payload.org || "";
      } catch {
        // ignore decode error
      }
    }

    console.log(JSON.stringify({ event: "woff_auth_success", domainId, orgId }));
    return new Response(
      JSON.stringify({
        token: response.token,
        expiresAt: response.expiresAt,
        orgId,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (err) {
    if (err instanceof ConnectError) {
      console.log(JSON.stringify({ event: "woff_auth_failure", domainId, error: err.message }));
      return jsonError(401, err.message);
    }
    throw err;
  }
}

export async function handleWoffConfig(
  request: Request,
  env: Env,
): Promise<Response> {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");
  if (!domain) {
    return jsonError(400, "domain parameter required");
  }

  console.log(JSON.stringify({ event: "woff_config", domain }));

  const transport = createTransport(env.GRPC_PROXY);
  const client = createClient(AuthService, transport);

  try {
    const res = await client.resolveSsoProvider({
      provider: "lineworks",
      externalOrgId: domain,
    });

    if (!res.available || !res.woffId) {
      console.log(JSON.stringify({ event: "woff_config_not_found", domain }));
      return jsonError(404, "WOFF not configured for this domain");
    }

    console.log(JSON.stringify({ event: "woff_config_found", domain, woffId: res.woffId }));
    return new Response(JSON.stringify({ woffId: res.woffId }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      return jsonError(500, err.message);
    }
    throw err;
  }
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
