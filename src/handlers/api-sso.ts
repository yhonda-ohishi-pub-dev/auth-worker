/**
 * SSO Settings API endpoints
 * Client JS → auth-worker API → gRPC SsoSettingsService (via cf-grpc-proxy)
 */

import { createClient, ConnectError } from "@connectrpc/connect";
import { SsoSettingsService } from "@yhonda-ohishi-pub-dev/logi-proto";
import type { Env } from "../index";
import { createTransportWithAuth } from "../lib/transport";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  return null;
}

export async function handleSsoList(
  request: Request,
  env: Env,
): Promise<Response> {
  const token = extractToken(request);
  if (!token) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const transport = createTransportWithAuth(env.GRPC_PROXY, token);
  const client = createClient(SsoSettingsService, transport);

  try {
    const response = await client.listConfigs({});
    return jsonResponse({
      configs: (response.configs || []).map((c) => ({
        provider: c.provider,
        clientId: c.clientId,
        hasClientSecret: c.hasClientSecret,
        externalOrgId: c.externalOrgId,
        enabled: c.enabled,
        woffId: c.woffId,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      return jsonResponse({ error: err.message }, 400);
    }
    throw err;
  }
}

export async function handleSsoUpsert(
  request: Request,
  env: Env,
): Promise<Response> {
  const token = extractToken(request);
  if (!token) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const body = (await request.json()) as {
    provider: string;
    clientId: string;
    clientSecret: string;
    externalOrgId: string;
    woffId?: string;
    enabled: boolean;
  };

  if (!body.provider || !body.clientId || !body.externalOrgId) {
    return jsonResponse({ error: "provider, clientId, externalOrgId are required" }, 400);
  }

  const transport = createTransportWithAuth(env.GRPC_PROXY, token);
  const client = createClient(SsoSettingsService, transport);

  try {
    const response = await client.upsertConfig({
      provider: body.provider,
      clientId: body.clientId,
      clientSecret: body.clientSecret || "",
      externalOrgId: body.externalOrgId,
      woffId: body.woffId || "",
      enabled: body.enabled ?? true,
    });
    return jsonResponse({
      provider: response.provider,
      clientId: response.clientId,
      hasClientSecret: response.hasClientSecret,
      externalOrgId: response.externalOrgId,
      woffId: response.woffId,
      enabled: response.enabled,
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      return jsonResponse({ error: err.message }, 400);
    }
    throw err;
  }
}

export async function handleSsoDelete(
  request: Request,
  env: Env,
): Promise<Response> {
  const token = extractToken(request);
  if (!token) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const body = (await request.json()) as { provider: string };
  if (!body.provider) {
    return jsonResponse({ error: "provider is required" }, 400);
  }

  const transport = createTransportWithAuth(env.GRPC_PROXY, token);
  const client = createClient(SsoSettingsService, transport);

  try {
    await client.deleteConfig({ provider: body.provider });
    return jsonResponse({ success: true });
  } catch (err) {
    if (err instanceof ConnectError) {
      return jsonResponse({ error: err.message }, 400);
    }
    throw err;
  }
}
