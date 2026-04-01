import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { createMockEnv } from "../helpers/mock-env";
import {
  handleSsoList,
  handleSsoUpsert,
  handleSsoDelete,
} from "../../src/handlers/api-sso";

const originalFetch = globalThis.fetch;
afterAll(() => {
  vi.stubGlobal("fetch", originalFetch);
});

function jsonRequest(
  url: string,
  body: unknown,
  token?: string,
  method = "POST",
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request(url, { method, headers, body: JSON.stringify(body) });
}

function getRequest(url: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request(url, { method: "GET", headers });
}

// ---------- handleSsoList ----------

describe("handleSsoList", () => {
  const env = createMockEnv();
  beforeEach(() => vi.restoreAllMocks());

  it("returns 401 without token", async () => {
    const res = await handleSsoList(getRequest("https://x.com"), env);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 with non-Bearer auth header", async () => {
    const req = new Request("https://x.com", {
      headers: { Authorization: "Basic abc" },
    });
    const res = await handleSsoList(req, env);
    expect(res.status).toBe(401);
  });

  it("returns mapped configs on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            configs: [
              {
                provider: "lineworks",
                client_id: "cid",
                external_org_id: "oid",
                enabled: true,
                woff_id: "wid",
                created_at: "2025-01-01",
                updated_at: "2025-01-02",
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const res = await handleSsoList(getRequest("https://x.com", "tok"), env);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { configs: unknown[] };
    expect(data.configs).toHaveLength(1);
    expect(data.configs[0]).toEqual({
      provider: "lineworks",
      clientId: "cid",
      hasClientSecret: true,
      externalOrgId: "oid",
      enabled: true,
      woffId: "wid",
      createdAt: "2025-01-01",
      updatedAt: "2025-01-02",
    });
  });

  it("handles empty configs array", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ configs: [] }), { status: 200 }),
      ),
    );
    const res = await handleSsoList(getRequest("https://x.com", "tok"), env);
    const data = (await res.json()) as { configs: unknown[] };
    expect(data.configs).toEqual([]);
  });

  it("handles undefined configs (fallback to empty)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({}), { status: 200 }),
      ),
    );
    const res = await handleSsoList(getRequest("https://x.com", "tok"), env);
    const data = (await res.json()) as { configs: unknown[] };
    expect(data.configs).toEqual([]);
  });

  it("handles null woff_id as empty string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            configs: [
              {
                provider: "p",
                client_id: "c",
                external_org_id: "o",
                enabled: false,
                woff_id: null,
                created_at: "t",
                updated_at: "t",
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const res = await handleSsoList(getRequest("https://x.com", "tok"), env);
    const data = (await res.json()) as { configs: Array<{ woffId: string }> };
    expect(data.configs[0].woffId).toBe("");
  });

  it("passes through error status from backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response("forbidden", { status: 403 }),
      ),
    );
    const res = await handleSsoList(getRequest("https://x.com", "tok"), env);
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("forbidden");
  });

  it("uses fallback error message when backend returns empty text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })),
    );
    const res = await handleSsoList(getRequest("https://x.com", "tok"), env);
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Failed to list configs");
  });
});

// ---------- handleSsoUpsert ----------

describe("handleSsoUpsert", () => {
  const env = createMockEnv();
  beforeEach(() => vi.restoreAllMocks());

  it("returns 401 without token", async () => {
    const res = await handleSsoUpsert(
      jsonRequest("https://x.com", { provider: "p" }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when provider is missing", async () => {
    const res = await handleSsoUpsert(
      jsonRequest(
        "https://x.com",
        { clientId: "c", externalOrgId: "o" },
        "tok",
      ),
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when clientId is missing", async () => {
    const res = await handleSsoUpsert(
      jsonRequest(
        "https://x.com",
        { provider: "p", externalOrgId: "o" },
        "tok",
      ),
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when externalOrgId is missing", async () => {
    const res = await handleSsoUpsert(
      jsonRequest("https://x.com", { provider: "p", clientId: "c" }, "tok"),
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns mapped config on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            provider: "lineworks",
            client_id: "cid",
            external_org_id: "oid",
            enabled: true,
            woff_id: "wid",
          }),
          { status: 200 },
        ),
      ),
    );
    const res = await handleSsoUpsert(
      jsonRequest(
        "https://x.com",
        {
          provider: "lineworks",
          clientId: "cid",
          clientSecret: "secret",
          externalOrgId: "oid",
          woffId: "wid",
          enabled: true,
        },
        "tok",
      ),
      env,
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      provider: "lineworks",
      clientId: "cid",
      hasClientSecret: true,
      externalOrgId: "oid",
      woffId: "wid",
      enabled: true,
    });
  });

  it("sends null for optional fields when not provided", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          provider: "p",
          client_id: "c",
          external_org_id: "o",
          enabled: true,
          woff_id: null,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);
    await handleSsoUpsert(
      jsonRequest(
        "https://x.com",
        { provider: "p", clientId: "c", externalOrgId: "o" },
        "tok",
      ),
      env,
    );
    const sentBody = JSON.parse(
      mockFetch.mock.calls[0][1].body as string,
    );
    expect(sentBody.client_secret).toBeNull();
    expect(sentBody.woff_id).toBeNull();
    expect(sentBody.enabled).toBe(true); // default via ??
  });

  it("handles null woff_id in response as empty string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            provider: "p",
            client_id: "c",
            external_org_id: "o",
            enabled: false,
            woff_id: null,
          }),
          { status: 200 },
        ),
      ),
    );
    const res = await handleSsoUpsert(
      jsonRequest(
        "https://x.com",
        { provider: "p", clientId: "c", externalOrgId: "o", enabled: false },
        "tok",
      ),
      env,
    );
    const data = (await res.json()) as { woffId: string };
    expect(data.woffId).toBe("");
  });

  it("passes through error status from backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response("conflict", { status: 409 }),
      ),
    );
    const res = await handleSsoUpsert(
      jsonRequest(
        "https://x.com",
        { provider: "p", clientId: "c", externalOrgId: "o" },
        "tok",
      ),
      env,
    );
    expect(res.status).toBe(409);
  });

  it("uses fallback error message when backend returns empty text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })),
    );
    const res = await handleSsoUpsert(
      jsonRequest(
        "https://x.com",
        { provider: "p", clientId: "c", externalOrgId: "o" },
        "tok",
      ),
      env,
    );
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Failed to upsert config");
  });
});

// ---------- handleSsoDelete ----------

describe("handleSsoDelete", () => {
  const env = createMockEnv();
  beforeEach(() => vi.restoreAllMocks());

  it("returns 401 without token", async () => {
    const res = await handleSsoDelete(
      jsonRequest("https://x.com", { provider: "p" }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when provider is missing", async () => {
    const res = await handleSsoDelete(
      jsonRequest("https://x.com", {}, "tok"),
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns success on delete", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("ok", { status: 200 })),
    );
    const res = await handleSsoDelete(
      jsonRequest("https://x.com", { provider: "lineworks" }, "tok"),
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
  });

  it("passes through error status from backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response("not found", { status: 404 }),
      ),
    );
    const res = await handleSsoDelete(
      jsonRequest("https://x.com", { provider: "p" }, "tok"),
      env,
    );
    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("not found");
  });

  it("uses fallback error message when backend returns empty text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })),
    );
    const res = await handleSsoDelete(
      jsonRequest("https://x.com", { provider: "p" }, "tok"),
      env,
    );
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Failed to delete config");
  });
});
