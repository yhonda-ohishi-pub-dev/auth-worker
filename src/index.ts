import { handleLoginPage } from "./handlers/login-page";
import { handleAuthLogin } from "./handlers/login-api";
import { handleGoogleRedirect } from "./handlers/google-redirect";
import { handleGoogleCallback } from "./handlers/google-callback";
import { handleLineworksRedirect } from "./handlers/lineworks-redirect";
import { handleLineworksCallback } from "./handlers/lineworks-callback";
import { handleAdminSsoPage, handleAdminSsoCallback } from "./handlers/admin-sso";
import { handleSsoList, handleSsoUpsert, handleSsoDelete } from "./handlers/api-sso";

export interface Env {
  GRPC_PROXY: Fetcher;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  OAUTH_STATE_SECRET: string;
  AUTH_WORKER_ORIGIN: string;
  ALLOWED_REDIRECT_ORIGINS: string;
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (request.method === "GET") {
        switch (url.pathname) {
          case "/login":
            return await handleLoginPage(request, env);
          case "/oauth/google/redirect":
            return await handleGoogleRedirect(request, env);
          case "/oauth/google/callback":
            return await handleGoogleCallback(request, env);
          case "/oauth/lineworks/redirect":
            return await handleLineworksRedirect(request, env);
          case "/oauth/lineworks/callback":
            return await handleLineworksCallback(request, env);
          case "/admin/sso":
            return await handleAdminSsoPage(request, env);
          case "/admin/sso/callback":
            return await handleAdminSsoCallback();
          default:
            return errorResponse(404, "Not found");
        }
      }

      if (request.method === "POST") {
        switch (url.pathname) {
          case "/auth/login":
            return await handleAuthLogin(request, env);
          case "/api/sso/list":
            return await handleSsoList(request, env);
          case "/api/sso/upsert":
            return await handleSsoUpsert(request, env);
          case "/api/sso/delete":
            return await handleSsoDelete(request, env);
          default:
            return errorResponse(404, "Not found");
        }
      }

      return errorResponse(405, "Method not allowed");
    } catch (err) {
      console.error("Unhandled error:", err);
      return errorResponse(
        500,
        err instanceof Error ? err.message : "Internal server error",
      );
    }
  },
};
