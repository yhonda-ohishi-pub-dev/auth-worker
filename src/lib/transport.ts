import { createGrpcWebTransport } from "@connectrpc/connect-web";
import type { Transport, Interceptor } from "@connectrpc/connect";

export function createTransport(grpcProxy: Fetcher): Transport {
  return createTransportWithAuth(grpcProxy);
}

/** Create transport with optional JWT auth header injection */
export function createTransportWithAuth(grpcProxy: Fetcher, token?: string): Transport {
  const proxyFetch = grpcProxy.fetch.bind(grpcProxy) as typeof globalThis.fetch;
  const wrappedFetch: typeof globalThis.fetch = (input, init) => {
    // Cloudflare Workers doesn't support redirect: "error"
    if (init?.redirect === "error") {
      const { redirect: _, ...rest } = init;
      return proxyFetch(input, { ...rest, redirect: "manual" });
    }
    return proxyFetch(input, init);
  };

  const interceptors: Interceptor[] = [];
  if (token) {
    interceptors.push((next) => async (req) => {
      req.header.set("x-auth-token", token);
      return next(req);
    });
  }

  return createGrpcWebTransport({
    baseUrl: "https://cf-grpc-proxy",
    fetch: wrappedFetch,
    interceptors,
  });
}
