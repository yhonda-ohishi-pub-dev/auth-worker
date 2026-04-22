import { describe, expect, it, beforeEach } from "vitest";
import {
  classifyOrigin,
  getAllowedOrigins,
  getDisplayOrigins,
  isWorktreeOrigin,
  _clearAllowedOriginsCache,
} from "../../src/lib/config";
import { createMockEnv, createMockKV } from "../helpers/mock-env";

describe("getAllowedOrigins", () => {
  beforeEach(() => {
    _clearAllowedOriginsCache();
  });

  it("unions origins:<WORKER_ENV>, origins:dev and origins:wt", async () => {
    const env = createMockEnv({
      WORKER_ENV: "prod",
      AUTH_CONFIG: createMockKV({
        "origins:prod": "https://a.example,https://b.example",
        "origins:dev": "https://x-dev.example",
        "origins:wt": "https://fluffy-frog.trycloudflare.com",
        "origins:staging": "https://should-not-appear.example",
      }),
    });

    const result = await getAllowedOrigins(env);
    expect(result).toBe(
      "https://a.example,https://b.example,https://x-dev.example,https://fluffy-frog.trycloudflare.com",
    );
  });

  it("reads origins:staging when WORKER_ENV=staging", async () => {
    const env = createMockEnv({
      WORKER_ENV: "staging",
      AUTH_CONFIG: createMockKV({
        "origins:prod": "https://prod-only.example",
        "origins:staging": "https://staging.example",
        "origins:dev": "https://dev.example",
        "origins:wt": "https://wt.trycloudflare.com",
      }),
    });

    const result = await getAllowedOrigins(env);
    expect(result).toBe(
      "https://staging.example,https://dev.example,https://wt.trycloudflare.com",
    );
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

  it("caches origins:<WORKER_ENV> and origins:dev but re-reads origins:wt each call", async () => {
    const calls: Record<string, number> = {};
    const env = createMockEnv({
      WORKER_ENV: "prod",
      AUTH_CONFIG: {
        get: async (key: string) => {
          calls[key] = (calls[key] ?? 0) + 1;
          if (key === "origins:prod") return "https://cached.example";
          if (key === "origins:wt") return "https://ephemeral.example";
          return null;
        },
      } as unknown as KVNamespace,
    });

    await getAllowedOrigins(env);
    await getAllowedOrigins(env);
    await getAllowedOrigins(env);

    expect(calls["origins:prod"]).toBe(1); // cached
    expect(calls["origins:dev"]).toBe(1); // cached
    expect(calls["origins:wt"]).toBe(3); // NOT cached — fresh read every call
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

  it("includes origins:wt when other keys are missing", async () => {
    const env = createMockEnv({
      WORKER_ENV: "prod",
      AUTH_CONFIG: createMockKV({
        "origins:wt": "https://only-wt.trycloudflare.com",
      }),
    });

    const result = await getAllowedOrigins(env);
    expect(result).toBe("https://only-wt.trycloudflare.com");
  });

  it("reflects origins:wt updates immediately (no in-memory cache)", async () => {
    let wtValue = "https://first.trycloudflare.com";
    const env = createMockEnv({
      WORKER_ENV: "prod",
      AUTH_CONFIG: {
        get: async (key: string) => {
          if (key === "origins:wt") return wtValue;
          return null;
        },
      } as unknown as KVNamespace,
    });

    const r1 = await getAllowedOrigins(env);
    expect(r1).toBe("https://first.trycloudflare.com");

    // simulate `wrangler kv key put origins:wt <new>` returning a new value
    wtValue = "https://second.trycloudflare.com";

    const r2 = await getAllowedOrigins(env);
    expect(r2).toBe("https://second.trycloudflare.com");
  });
});

describe("getDisplayOrigins", () => {
  beforeEach(() => {
    _clearAllowedOriginsCache();
  });

  it("unions origins:<WORKER_ENV> and origins:dev, excluding origins:wt", async () => {
    const env = createMockEnv({
      WORKER_ENV: "prod",
      AUTH_CONFIG: createMockKV({
        "origins:prod": "https://a.example,https://b.example",
        "origins:dev": "https://x-dev.example",
        "origins:wt": "https://should-not-appear.trycloudflare.com",
      }),
    });

    const result = await getDisplayOrigins(env);
    expect(result).toBe("https://a.example,https://b.example,https://x-dev.example");
    expect(result).not.toContain("trycloudflare.com");
  });

  it("uses origins:staging when WORKER_ENV=staging", async () => {
    const env = createMockEnv({
      WORKER_ENV: "staging",
      AUTH_CONFIG: createMockKV({
        "origins:prod": "https://prod.example",
        "origins:staging": "https://staging.example",
        "origins:dev": "https://dev.example",
        "origins:wt": "https://wt.trycloudflare.com",
      }),
    });

    const result = await getDisplayOrigins(env);
    expect(result).toBe("https://staging.example,https://dev.example");
  });

  it("returns empty string when both keys are empty", async () => {
    const env = createMockEnv({
      WORKER_ENV: "prod",
      AUTH_CONFIG: createMockKV(),
    });

    const result = await getDisplayOrigins(env);
    expect(result).toBe("");
  });
});

describe("classifyOrigin", () => {
  beforeEach(() => {
    _clearAllowedOriginsCache();
  });

  it("returns 'ohishi-exp' when origin matches an ohishi-exp token in app-orgs", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({
        "app-orgs": JSON.stringify({ "dtako-admin": "ohishi-exp", ohishi2: "ohishi-exp" }),
      }),
    });

    expect(await classifyOrigin(env, "https://dtako-admin.example")).toBe("ohishi-exp");
    expect(await classifyOrigin(env, "https://ohishi2.example")).toBe("ohishi-exp");
  });

  it("returns 'ippoan' when origin does not match any ohishi-exp token", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({
        "app-orgs": JSON.stringify({ "dtako-admin": "ohishi-exp" }),
      }),
    });

    expect(await classifyOrigin(env, "https://alc-app.example")).toBe("ippoan");
  });

  it("returns 'ippoan' when app-orgs KV key is missing", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV(),
    });

    expect(await classifyOrigin(env, "https://dtako-admin.example")).toBe("ippoan");
  });

  it("returns 'ippoan' when app-orgs JSON is malformed", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({ "app-orgs": "{not valid json" }),
    });

    expect(await classifyOrigin(env, "https://dtako-admin.example")).toBe("ippoan");
  });

  it("ignores entries whose org value is not 'ohishi-exp'", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({
        "app-orgs": JSON.stringify({ "dtako-admin": "some-other-org" }),
      }),
    });

    expect(await classifyOrigin(env, "https://dtako-admin.example")).toBe("ippoan");
  });
});

describe("isWorktreeOrigin", () => {
  beforeEach(() => {
    _clearAllowedOriginsCache();
  });

  it("returns true for an origin that is listed in origins:wt", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({
        "origins:wt": "https://a.trycloudflare.com,https://b.trycloudflare.com",
      }),
    });

    expect(await isWorktreeOrigin(env, "https://a.trycloudflare.com")).toBe(true);
    expect(await isWorktreeOrigin(env, "https://b.trycloudflare.com")).toBe(true);
  });

  it("returns false for an origin not in origins:wt", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({
        "origins:wt": "https://a.trycloudflare.com",
      }),
    });

    expect(await isWorktreeOrigin(env, "https://other.example")).toBe(false);
  });

  it("returns false when origins:wt key is empty/missing", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV(),
    });

    expect(await isWorktreeOrigin(env, "https://any.example")).toBe(false);
  });

  it("handles whitespace around entries", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({
        "origins:wt": " https://a.trycloudflare.com , https://b.trycloudflare.com ",
      }),
    });

    expect(await isWorktreeOrigin(env, "https://a.trycloudflare.com")).toBe(true);
    expect(await isWorktreeOrigin(env, "https://b.trycloudflare.com")).toBe(true);
  });

  it("requires exact origin match (no substring)", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({
        "origins:wt": "https://full.trycloudflare.com",
      }),
    });

    expect(await isWorktreeOrigin(env, "https://full.trycloudflare.com/some/path")).toBe(false);
    expect(await isWorktreeOrigin(env, "https://full.trycloudflare.com")).toBe(true);
  });
});
