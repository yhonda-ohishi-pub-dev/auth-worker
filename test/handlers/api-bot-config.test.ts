import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { createMockEnv } from "../helpers/mock-env";
import {
  handleBotConfigList,
  handleBotConfigUpsert,
  handleBotConfigDelete,
} from "../../src/handlers/api-bot-config";

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

// ---------- handleBotConfigList ----------

describe("handleBotConfigList", () => {
  const env = createMockEnv();
  beforeEach(() => vi.restoreAllMocks());

  it("returns 401 without token", async () => {
    const res = await handleBotConfigList(getRequest("https://x.com"), env);
    expect(res.status).toBe(401);
  });

  it("returns 401 with non-Bearer auth header", async () => {
    const req = new Request("https://x.com", {
      headers: { Authorization: "Basic abc" },
    });
    const res = await handleBotConfigList(req, env);
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
                id: "id1",
                provider: "lineworks",
                name: "Bot1",
                client_id: "cid",
                service_account: "sa",
                bot_id: "bid",
                enabled: true,
                created_at: "2025-01-01",
                updated_at: "2025-01-02",
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const res = await handleBotConfigList(
      getRequest("https://x.com", "tok"),
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { configs: unknown[] };
    expect(data.configs).toHaveLength(1);
    expect(data.configs[0]).toEqual({
      id: "id1",
      provider: "lineworks",
      name: "Bot1",
      clientId: "cid",
      hasClientSecret: true,
      serviceAccount: "sa",
      hasPrivateKey: true,
      botId: "bid",
      enabled: true,
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
    const res = await handleBotConfigList(
      getRequest("https://x.com", "tok"),
      env,
    );
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
    const res = await handleBotConfigList(
      getRequest("https://x.com", "tok"),
      env,
    );
    const data = (await res.json()) as { configs: unknown[] };
    expect(data.configs).toEqual([]);
  });

  it("passes through error status from backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response("forbidden", { status: 403 }),
      ),
    );
    const res = await handleBotConfigList(
      getRequest("https://x.com", "tok"),
      env,
    );
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("forbidden");
  });

  it("uses fallback error message when backend returns empty text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })),
    );
    const res = await handleBotConfigList(
      getRequest("https://x.com", "tok"),
      env,
    );
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Failed to list configs");
  });
});

// ---------- handleBotConfigUpsert ----------

describe("handleBotConfigUpsert", () => {
  const env = createMockEnv();
  beforeEach(() => vi.restoreAllMocks());

  it("returns 401 without token", async () => {
    const res = await handleBotConfigUpsert(
      jsonRequest("https://x.com", { name: "n" }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when name is missing", async () => {
    const res = await handleBotConfigUpsert(
      jsonRequest(
        "https://x.com",
        { clientId: "c", botId: "b", serviceAccount: "s" },
        "tok",
      ),
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when clientId is missing", async () => {
    const res = await handleBotConfigUpsert(
      jsonRequest(
        "https://x.com",
        { name: "n", botId: "b", serviceAccount: "s" },
        "tok",
      ),
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when botId is missing", async () => {
    const res = await handleBotConfigUpsert(
      jsonRequest(
        "https://x.com",
        { name: "n", clientId: "c", serviceAccount: "s" },
        "tok",
      ),
      env,
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when serviceAccount is missing", async () => {
    const res = await handleBotConfigUpsert(
      jsonRequest(
        "https://x.com",
        { name: "n", clientId: "c", botId: "b" },
        "tok",
      ),
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
            id: "id1",
            provider: "lineworks",
            name: "Bot1",
            client_id: "cid",
            service_account: "sa",
            bot_id: "bid",
            enabled: true,
          }),
          { status: 200 },
        ),
      ),
    );
    const res = await handleBotConfigUpsert(
      jsonRequest(
        "https://x.com",
        {
          id: "id1",
          provider: "custom",
          name: "Bot1",
          clientId: "cid",
          clientSecret: "secret",
          serviceAccount: "sa",
          privateKey: "pk",
          botId: "bid",
          enabled: true,
        },
        "tok",
      ),
      env,
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      id: "id1",
      provider: "lineworks",
      name: "Bot1",
      clientId: "cid",
      hasClientSecret: true,
      serviceAccount: "sa",
      hasPrivateKey: true,
      botId: "bid",
      enabled: true,
    });
  });

  it("sends defaults for optional fields when not provided", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "id1",
          provider: "lineworks",
          name: "n",
          client_id: "c",
          service_account: "s",
          bot_id: "b",
          enabled: true,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);
    await handleBotConfigUpsert(
      jsonRequest(
        "https://x.com",
        { name: "n", clientId: "c", serviceAccount: "s", botId: "b" },
        "tok",
      ),
      env,
    );
    const sentBody = JSON.parse(
      mockFetch.mock.calls[0][1].body as string,
    );
    expect(sentBody.id).toBeNull();
    expect(sentBody.provider).toBe("lineworks");
    expect(sentBody.client_secret).toBeNull();
    expect(sentBody.private_key).toBeNull();
    expect(sentBody.enabled).toBe(true); // default via ??
  });

  it("passes through error status from backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response("conflict", { status: 409 }),
      ),
    );
    const res = await handleBotConfigUpsert(
      jsonRequest(
        "https://x.com",
        { name: "n", clientId: "c", serviceAccount: "s", botId: "b" },
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
    const res = await handleBotConfigUpsert(
      jsonRequest(
        "https://x.com",
        { name: "n", clientId: "c", serviceAccount: "s", botId: "b" },
        "tok",
      ),
      env,
    );
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Failed to upsert config");
  });
});

// ---------- handleBotConfigDelete ----------

describe("handleBotConfigDelete", () => {
  const env = createMockEnv();
  beforeEach(() => vi.restoreAllMocks());

  it("returns 401 without token", async () => {
    const res = await handleBotConfigDelete(
      jsonRequest("https://x.com", { id: "x" }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    const res = await handleBotConfigDelete(
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
    const res = await handleBotConfigDelete(
      jsonRequest("https://x.com", { id: "id1" }, "tok"),
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
    const res = await handleBotConfigDelete(
      jsonRequest("https://x.com", { id: "x" }, "tok"),
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
    const res = await handleBotConfigDelete(
      jsonRequest("https://x.com", { id: "x" }, "tok"),
      env,
    );
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Failed to delete config");
  });
});
