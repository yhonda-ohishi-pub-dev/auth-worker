import { ConnectError } from "@connectrpc/connect";

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(status: number, message: string): Response {
  return jsonResponse({ error: message }, status);
}

export function connectErrorToHttpStatus(err: ConnectError): number {
  switch (err.code) {
    case 3: // INVALID_ARGUMENT
      return 400;
    case 16: // UNAUTHENTICATED
      return 401;
    case 7: // PERMISSION_DENIED
      return 403;
    case 5: // NOT_FOUND
      return 404;
    case 13: // INTERNAL
      return 500;
    case 14: // UNAVAILABLE
      return 503;
    default:
      return 500;
  }
}
