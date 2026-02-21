/**
 * Bot Config API endpoints
 * Client JS → auth-worker API → gRPC BotConfigService (via cf-grpc-proxy)
 */

import { createClient, ConnectError } from "@connectrpc/connect";
import { BotConfigService } from "@yhonda-ohishi-pub-dev/logi-proto";
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

export async function handleBotConfigList(
  request: Request,
  env: Env,
): Promise<Response> {
  const token = extractToken(request);
  if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

  console.log(JSON.stringify({ event: "bot_config_list" }));

  const transport = createTransportWithAuth(env.GRPC_PROXY, token);
  const client = createClient(BotConfigService, transport);

  try {
    const response = await client.listConfigs({});
    return jsonResponse({
      configs: (response.configs || []).map((c) => ({
        id: c.id,
        provider: c.provider,
        name: c.name,
        clientId: c.clientId,
        hasClientSecret: c.hasClientSecret,
        serviceAccount: c.serviceAccount,
        hasPrivateKey: c.hasPrivateKey,
        botId: c.botId,
        enabled: c.enabled,
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

export async function handleBotConfigUpsert(
  request: Request,
  env: Env,
): Promise<Response> {
  const token = extractToken(request);
  if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = (await request.json()) as {
    id?: string;
    provider?: string;
    name: string;
    clientId: string;
    clientSecret?: string;
    serviceAccount: string;
    privateKey?: string;
    botId: string;
    enabled: boolean;
  };

  if (!body.name || !body.clientId || !body.botId || !body.serviceAccount) {
    return jsonResponse(
      { error: "name, clientId, serviceAccount, and botId are required" },
      400,
    );
  }

  console.log(
    JSON.stringify({
      event: "bot_config_upsert",
      name: body.name,
      botId: body.botId,
    }),
  );

  const transport = createTransportWithAuth(env.GRPC_PROXY, token);
  const client = createClient(BotConfigService, transport);

  try {
    const response = await client.upsertConfig({
      id: body.id || "",
      provider: body.provider || "lineworks",
      name: body.name,
      clientId: body.clientId,
      clientSecret: body.clientSecret || "",
      serviceAccount: body.serviceAccount,
      privateKey: body.privateKey || "",
      botId: body.botId,
      enabled: body.enabled ?? true,
    });
    return jsonResponse({
      id: response.id,
      provider: response.provider,
      name: response.name,
      clientId: response.clientId,
      hasClientSecret: response.hasClientSecret,
      serviceAccount: response.serviceAccount,
      hasPrivateKey: response.hasPrivateKey,
      botId: response.botId,
      enabled: response.enabled,
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      return jsonResponse({ error: err.message }, 400);
    }
    throw err;
  }
}

export async function handleBotConfigDelete(
  request: Request,
  env: Env,
): Promise<Response> {
  const token = extractToken(request);
  if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = (await request.json()) as { id: string };
  if (!body.id) {
    return jsonResponse({ error: "id is required" }, 400);
  }

  console.log(JSON.stringify({ event: "bot_config_delete", id: body.id }));

  const transport = createTransportWithAuth(env.GRPC_PROXY, token);
  const client = createClient(BotConfigService, transport);

  try {
    await client.deleteConfig({ id: body.id });
    return jsonResponse({ success: true });
  } catch (err) {
    if (err instanceof ConnectError) {
      return jsonResponse({ error: err.message }, 400);
    }
    throw err;
  }
}
