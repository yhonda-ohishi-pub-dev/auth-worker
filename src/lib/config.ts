/**
 * KV-backed allowlist with in-memory cache.
 *
 * KV keys:
 *   origins:prod    - production frontends
 *   origins:staging - staging frontends
 *   origins:dev     - dev-proxy frontends (*-dev.ippoan.org)
 *
 * At runtime the worker reads `origins:<WORKER_ENV>` ∪ `origins:dev` and unions them.
 */

import type { Env } from "../index";

const CACHE_TTL_MS = 60_000;

type CacheEntry = { value: string; expiresAt: number };
const cache = new Map<string, CacheEntry>();

async function readKey(env: Env, key: string): Promise<string> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;

  let value = "";
  try {
    value = (await env.AUTH_CONFIG?.get(key)) ?? "";
  } catch {
    value = "";
  }
  cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
}

/**
 * Returns the combined allowlist for the current worker environment
 * (`origins:<WORKER_ENV>` ∪ `origins:dev`).
 */
export async function getAllowedOrigins(env: Env): Promise<string> {
  const workerEnv = env.WORKER_ENV || "prod";
  const [envOrigins, devOrigins] = await Promise.all([
    readKey(env, `origins:${workerEnv}`),
    readKey(env, "origins:dev"),
  ]);

  return [envOrigins, devOrigins]
    .filter((s) => s.length > 0)
    .join(",");
}

/** Test-only cache clear helper. */
export function _clearAllowedOriginsCache(): void {
  cache.clear();
}
