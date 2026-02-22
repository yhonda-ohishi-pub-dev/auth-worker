/**
 * Organization switching API endpoint
 * POST /api/switch-org — issues new JWT for a different organization
 */

import { createClient, ConnectError } from "@connectrpc/connect";
import { AuthService } from "@yhonda-ohishi-pub-dev/logi-proto";
import type { Env } from "../index";
import { createTransportWithAuth } from "../lib/transport";
import { corsJsonResponse, extractToken } from "../lib/errors";

export async function handleSwitchOrg(
  request: Request,
  env: Env,
): Promise<Response> {
  const token = extractToken(request);
  if (!token) return corsJsonResponse({ error: "Unauthorized" }, 401);

  const body = (await request.json()) as { organizationId: string };
  if (!body.organizationId) {
    return corsJsonResponse({ error: "organizationId is required" }, 400);
  }

  const transport = createTransportWithAuth(env.GRPC_PROXY, token);
  const client = createClient(AuthService, transport);

  try {
    const response = await client.switchOrganization({
      organizationId: body.organizationId,
    });

    // Extract org_slug from the new JWT payload
    let orgSlug = "";
    try {
      const payload = JSON.parse(atob(response.token.split(".")[1]!));
      orgSlug = payload.org_slug || "";
    } catch { /* ignore */ }

    return corsJsonResponse({
      token: response.token,
      expiresAt: response.expiresAt,
      orgId: response.organizationId,
      orgSlug,
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      return corsJsonResponse({ error: err.message }, 400);
    }
    throw err;
  }
}
