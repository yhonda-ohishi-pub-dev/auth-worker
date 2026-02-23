/**
 * Access Request API endpoints
 * Client JS → auth-worker API → gRPC AccessRequestService (via cf-grpc-proxy)
 */

import { createClient, ConnectError } from "@connectrpc/connect";
import { AccessRequestService } from "@yhonda-ohishi-pub-dev/logi-proto";
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

export async function handleAccessRequestCreate(
  request: Request,
  env: Env,
): Promise<Response> {
  const token = extractToken(request);
  if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = (await request.json()) as { org_slug: string };
  if (!body.org_slug) return jsonResponse({ error: "org_slug is required" }, 400);

  const transport = createTransportWithAuth(env.GRPC_PROXY, token);
  const client = createClient(AccessRequestService, transport);

  try {
    const response = await client.createAccessRequest({ orgSlug: body.org_slug });
    return jsonResponse({
      id: response.id,
      status: response.status,
      org_name: response.orgName,
    });
  } catch (err) {
    if (err instanceof ConnectError) return jsonResponse({ error: err.message }, 400);
    throw err;
  }
}

export async function handleAccessRequestList(
  request: Request,
  env: Env,
): Promise<Response> {
  const token = extractToken(request);
  if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = (await request.json()) as { status_filter?: string };

  const transport = createTransportWithAuth(env.GRPC_PROXY, token);
  const client = createClient(AccessRequestService, transport);

  try {
    const response = await client.listAccessRequests({
      statusFilter: body.status_filter || "",
    });
    return jsonResponse({
      requests: (response.requests || []).map((r) => ({
        id: r.id,
        userId: r.userId,
        email: r.email,
        displayName: r.displayName,
        avatarUrl: r.avatarUrl,
        provider: r.provider,
        status: r.status,
        role: r.role,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    if (err instanceof ConnectError) return jsonResponse({ error: err.message }, 400);
    throw err;
  }
}

export async function handleAccessRequestApprove(
  request: Request,
  env: Env,
): Promise<Response> {
  const token = extractToken(request);
  if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = (await request.json()) as { request_id: string; role?: string };
  if (!body.request_id) return jsonResponse({ error: "request_id is required" }, 400);

  const transport = createTransportWithAuth(env.GRPC_PROXY, token);
  const client = createClient(AccessRequestService, transport);

  try {
    await client.approveAccessRequest({
      requestId: body.request_id,
      role: body.role || "member",
    });
    return jsonResponse({ success: true });
  } catch (err) {
    if (err instanceof ConnectError) return jsonResponse({ error: err.message }, 400);
    throw err;
  }
}

export async function handleAccessRequestDecline(
  request: Request,
  env: Env,
): Promise<Response> {
  const token = extractToken(request);
  if (!token) return jsonResponse({ error: "Unauthorized" }, 401);

  const body = (await request.json()) as { request_id: string };
  if (!body.request_id) return jsonResponse({ error: "request_id is required" }, 400);

  const transport = createTransportWithAuth(env.GRPC_PROXY, token);
  const client = createClient(AccessRequestService, transport);

  try {
    await client.declineAccessRequest({ requestId: body.request_id });
    return jsonResponse({ success: true });
  } catch (err) {
    if (err instanceof ConnectError) return jsonResponse({ error: err.message }, 400);
    throw err;
  }
}
