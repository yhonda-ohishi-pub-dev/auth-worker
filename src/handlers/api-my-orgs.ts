/**
 * Organization list API endpoint
 * POST /api/my-orgs — returns organizations the authenticated user belongs to
 */

import { createClient, ConnectError } from "@connectrpc/connect";
import { OrganizationService } from "@yhonda-ohishi-pub-dev/logi-proto";
import type { Env } from "../index";
import { createTransportWithAuth } from "../lib/transport";
import { corsJsonResponse, extractToken } from "../lib/errors";

export async function handleMyOrgs(
  request: Request,
  env: Env,
): Promise<Response> {
  const token = extractToken(request);
  if (!token) return corsJsonResponse({ error: "Unauthorized" }, 401);

  const transport = createTransportWithAuth(env.GRPC_PROXY, token);
  const client = createClient(OrganizationService, transport);

  try {
    const response = await client.listMyOrganizations({});
    return corsJsonResponse({
      organizations: (response.organizations || []).map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        role: o.role,
      })),
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      return corsJsonResponse({ error: err.message }, 400);
    }
    throw err;
  }
}
