import { handleLoginPage } from "./handlers/login-page";
import { handleAuthLogin } from "./handlers/login-api";
import { handleGoogleRedirect } from "./handlers/google-redirect";
import { handleGoogleCallback } from "./handlers/google-callback";

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
          default:
            return errorResponse(404, "Not found");
        }
      }

      if (request.method === "POST") {
        switch (url.pathname) {
          case "/auth/login":
            return await handleAuthLogin(request, env);
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
