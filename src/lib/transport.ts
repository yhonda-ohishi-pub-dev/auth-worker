import { createGrpcWebTransport } from "@connectrpc/connect-web";
import type { Transport } from "@connectrpc/connect";

export function createTransport(grpcProxy: Fetcher): Transport {
  const proxyFetch = grpcProxy.fetch.bind(grpcProxy) as typeof globalThis.fetch;
  const wrappedFetch: typeof globalThis.fetch = (input, init) => {
    // Cloudflare Workers doesn't support redirect: "error"
    if (init?.redirect === "error") {
      const { redirect: _, ...rest } = init;
      return proxyFetch(input, { ...rest, redirect: "manual" });
    }
    return proxyFetch(input, init);
  };
  return createGrpcWebTransport({
    baseUrl: "https://cf-grpc-proxy",
    fetch: wrappedFetch,
  });
}
