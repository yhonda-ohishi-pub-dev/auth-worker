import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { createMockEnv } from "../helpers/mock-env";
import {
  handleUsersList,
  handleInvitationsList,
  handleInviteUser,
  handleDeleteInvitation,
  handleDeleteUser,
} from "../../src/handlers/api-users";

const originalFetch = globalThis.fetch;
afterAll(() => {
  vi.stubGlobal("fetch", originalFetch);
});

function jsonRequest(url: string, body: unknown, token?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function getRequest(url: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new Request(url, { method: "GET", headers });
}

// ---------- handleUsersList ----------

describe("handleUsersList", () => {
  const env = createMockEnv();
  beforeEach(() => vi.restoreAllMocks());

  it("returns 401 without token", async () => {
    const res = await handleUsersList(getRequest("https://x.com"), env);
    expect(res.status).toBe(401);
  });

  it("returns 401 with non-Bearer auth header", async () => {
    const req = new Request("https://x.com", {
      headers: { Authorization: "Basic abc" },
    });
    const res = await handleUsersList(req, env);
    expect(res.status).toBe(401);
  });

  it("returns users list on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({ users: [{ id: "u1", email: "a@b.com" }] }),
          { status: 200 },
        ),
      ),
    );
    const res = await handleUsersList(
      getRequest("https://x.com", "tok"),
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { users: unknown[] };
    expect(data.users).toHaveLength(1);
  });

  it("passes through error status from backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response("forbidden", { status: 403 }),
      ),
    );
    const res = await handleUsersList(
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
    const res = await handleUsersList(
      getRequest("https://x.com", "tok"),
      env,
    );
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Failed to list users");
  });
});

// ---------- handleInvitationsList ----------

describe("handleInvitationsList", () => {
  const env = createMockEnv();
  beforeEach(() => vi.restoreAllMocks());

  it("returns 401 without token", async () => {
    const res = await handleInvitationsList(getRequest("https://x.com"), env);
    expect(res.status).toBe(401);
  });

  it("returns invitations list on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({ invitations: [{ id: "i1", email: "a@b.com" }] }),
          { status: 200 },
        ),
      ),
    );
    const res = await handleInvitationsList(
      getRequest("https://x.com", "tok"),
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { invitations: unknown[] };
    expect(data.invitations).toHaveLength(1);
  });

  it("passes through error status from backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response("forbidden", { status: 403 }),
      ),
    );
    const res = await handleInvitationsList(
      getRequest("https://x.com", "tok"),
      env,
    );
    expect(res.status).toBe(403);
  });

  it("uses fallback error message when backend returns empty text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })),
    );
    const res = await handleInvitationsList(
      getRequest("https://x.com", "tok"),
      env,
    );
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Failed to list invitations");
  });
});

// ---------- handleInviteUser ----------

describe("handleInviteUser", () => {
  const env = createMockEnv();
  beforeEach(() => vi.restoreAllMocks());

  it("returns 401 without token", async () => {
    const res = await handleInviteUser(
      jsonRequest("https://x.com", { email: "a@b.com" }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when email is missing", async () => {
    const res = await handleInviteUser(
      jsonRequest("https://x.com", {}, "tok"),
      env,
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("email is required");
  });

  it("returns invitation on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: "i1", email: "a@b.com", role: "admin" }),
          { status: 200 },
        ),
      ),
    );
    const res = await handleInviteUser(
      jsonRequest("https://x.com", { email: "a@b.com" }, "tok"),
      env,
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { id: string };
    expect(data.id).toBe("i1");
  });

  it("sends default role 'admin' when role is not provided", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "i1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", mockFetch);
    await handleInviteUser(
      jsonRequest("https://x.com", { email: "a@b.com" }, "tok"),
      env,
    );
    const sentBody = JSON.parse(
      mockFetch.mock.calls[0][1].body as string,
    );
    expect(sentBody.role).toBe("admin");
  });

  it("sends provided role when specified", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "i1" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", mockFetch);
    await handleInviteUser(
      jsonRequest("https://x.com", { email: "a@b.com", role: "viewer" }, "tok"),
      env,
    );
    const sentBody = JSON.parse(
      mockFetch.mock.calls[0][1].body as string,
    );
    expect(sentBody.role).toBe("viewer");
  });

  it("passes through error status from backend", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response("conflict", { status: 409 }),
      ),
    );
    const res = await handleInviteUser(
      jsonRequest("https://x.com", { email: "a@b.com" }, "tok"),
      env,
    );
    expect(res.status).toBe(409);
  });

  it("uses fallback error message when backend returns empty text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })),
    );
    const res = await handleInviteUser(
      jsonRequest("https://x.com", { email: "a@b.com" }, "tok"),
      env,
    );
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Failed to invite user");
  });
});

// ---------- handleDeleteInvitation ----------

describe("handleDeleteInvitation", () => {
  const env = createMockEnv();
  beforeEach(() => vi.restoreAllMocks());

  it("returns 401 without token", async () => {
    const res = await handleDeleteInvitation(
      jsonRequest("https://x.com", { id: "i1" }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    const res = await handleDeleteInvitation(
      jsonRequest("https://x.com", {}, "tok"),
      env,
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("id is required");
  });

  it("returns success on delete", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("ok", { status: 200 })),
    );
    const res = await handleDeleteInvitation(
      jsonRequest("https://x.com", { id: "i1" }, "tok"),
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
    const res = await handleDeleteInvitation(
      jsonRequest("https://x.com", { id: "i1" }, "tok"),
      env,
    );
    expect(res.status).toBe(404);
  });

  it("uses fallback error message when backend returns empty text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })),
    );
    const res = await handleDeleteInvitation(
      jsonRequest("https://x.com", { id: "i1" }, "tok"),
      env,
    );
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Failed to delete invitation");
  });
});

// ---------- handleDeleteUser ----------

describe("handleDeleteUser", () => {
  const env = createMockEnv();
  beforeEach(() => vi.restoreAllMocks());

  it("returns 401 without token", async () => {
    const res = await handleDeleteUser(
      jsonRequest("https://x.com", { id: "u1" }),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when id is missing", async () => {
    const res = await handleDeleteUser(
      jsonRequest("https://x.com", {}, "tok"),
      env,
    );
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("id is required");
  });

  it("returns success on delete", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("ok", { status: 200 })),
    );
    const res = await handleDeleteUser(
      jsonRequest("https://x.com", { id: "u1" }, "tok"),
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
    const res = await handleDeleteUser(
      jsonRequest("https://x.com", { id: "u1" }, "tok"),
      env,
    );
    expect(res.status).toBe(404);
  });

  it("uses fallback error message when backend returns empty text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("", { status: 500 })),
    );
    const res = await handleDeleteUser(
      jsonRequest("https://x.com", { id: "u1" }, "tok"),
      env,
    );
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Failed to delete user");
  });
});
