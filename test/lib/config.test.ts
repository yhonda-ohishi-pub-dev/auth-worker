import { describe, expect, it, beforeEach } from "vitest";
import { getAllowedOrigins, _clearAllowedOriginsCache } from "../../src/lib/config";
import { createMockEnv, createMockKV } from "../helpers/mock-env";

describe("getAllowedOrigins", () => {
  beforeEach(() => {
    _clearAllowedOriginsCache();
  });

  it("unions origins:<WORKER_ENV> and origins:dev", async () => {
    const env = createMockEnv({
      WORKER_ENV: "prod",
      AUTH_CONFIG: createMockKV({
        "origins:prod": "https://a.example,https://b.example",
        "origins:dev": "https://x-dev.example",
        "origins:staging": "https://should-not-appear.example",
      }),
    });

    const result = await getAllowedOrigins(env);
    expect(result).toBe("https://a.example,https://b.example,https://x-dev.example");
  });

  it("reads origins:staging when WORKER_ENV=staging", async () => {
    const env = createMockEnv({
      WORKER_ENV: "staging",
      AUTH_CONFIG: createMockKV({
        "origins:prod": "https://prod-only.example",
        "origins:staging": "https://staging.example",
        "origins:dev": "https://dev.example",
      }),
    });

    const result = await getAllowedOrigins(env);
    expect(result).toBe("https://staging.example,https://dev.example");
  });

  it("returns empty string when KV is empty", async () => {
    const env = createMockEnv({
      WORKER_ENV: "prod",
      AUTH_CONFIG: createMockKV(),
    });

    const result = await getAllowedOrigins(env);
    expect(result).toBe("");
  });

  it("returns empty string when KV throws", async () => {
    const env = createMockEnv({
      WORKER_ENV: "prod",
      AUTH_CONFIG: {
        get: async () => {
          throw new Error("kv down");
        },
      } as unknown as KVNamespace,
    });

    const result = await getAllowedOrigins(env);
    expect(result).toBe("");
  });

  it("caches results across calls", async () => {
    let calls = 0;
    const env = createMockEnv({
      WORKER_ENV: "prod",
      AUTH_CONFIG: {
        get: async (key: string) => {
          calls++;
          if (key === "origins:prod") return "https://cached.example";
          return null;
        },
      } as unknown as KVNamespace,
    });

    await getAllowedOrigins(env);
    await getAllowedOrigins(env);
    await getAllowedOrigins(env);

    // 2 KV keys (origins:prod + origins:dev) read once each, then cached
    expect(calls).toBe(2);
  });

  it("defaults WORKER_ENV to 'prod' when unset", async () => {
    const env = createMockEnv({
      WORKER_ENV: "",
      AUTH_CONFIG: createMockKV({
        "origins:prod": "https://default-prod.example",
      }),
    });

    const result = await getAllowedOrigins(env);
    expect(result).toBe("https://default-prod.example");
  });
});
