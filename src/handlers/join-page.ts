/**
 * Join page handler: GET /join/:slug
 * Shows organization name + OAuth buttons for requesting access
 */

import { createClient } from "@connectrpc/connect";
import { AccessRequestService } from "@yhonda-ohishi-pub-dev/logi-proto";
import type { Env } from "../index";
import { createTransport } from "../lib/transport";
import { renderJoinPage, renderJoinNotFoundPage } from "../lib/join-html";

export async function handleJoinPage(
  request: Request,
  env: Env,
  slug: string,
): Promise<Response> {
  const transport = createTransport(env.GRPC_PROXY);
  const client = createClient(AccessRequestService, transport);

  try {
    const orgInfo = await client.getOrganizationBySlug({ slug });

    if (!orgInfo.found) {
      return new Response(renderJoinNotFoundPage(), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const html = renderJoinPage({
      orgName: orgInfo.name,
      orgSlug: slug,
      googleEnabled: Boolean(env.GOOGLE_CLIENT_ID),
      authWorkerOrigin: env.AUTH_WORKER_ORIGIN,
    });

    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("Error fetching organization:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
