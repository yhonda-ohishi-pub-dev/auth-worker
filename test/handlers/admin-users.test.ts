import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockEnv } from "../helpers/mock-env";

vi.mock("../../src/lib/admin-users-html", () => ({
  renderAdminUsersPage: vi.fn(() => "<html>mock admin users page</html>"),
}));

import {
  handleAdminUsersPage,
  handleAdminUsersCallback,
} from "../../src/handlers/admin-users";
import { renderAdminUsersPage } from "../../src/lib/admin-users-html";

describe("handleAdminUsersPage", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("redirects to /login when no cookie", async () => {
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/users");

    const response = await handleAdminUsersPage(request, env);

    expect(response.status).toBe(302);
    const location = response.headers.get("Location");
    expect(location).toContain("/login?redirect_uri=");
    expect(location).toContain(encodeURIComponent("/admin/users/callback"));
  });

  it("uses sso_admin_token cookie when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
    );
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/users", {
      headers: { Cookie: "sso_admin_token=admin-jwt-123" },
    });

    const response = await handleAdminUsersPage(request, env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>mock admin users page</html>");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://alc-api.test.example/api/admin/users",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-jwt-123" },
      }),
    );
  });

  it("falls back to logi_auth_token cookie", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
    );
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/users", {
      headers: { Cookie: "logi_auth_token=shared-jwt-456" },
    });

    const response = await handleAdminUsersPage(request, env);

    expect(response.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: { Authorization: "Bearer shared-jwt-456" },
      }),
    );
  });

  it("redirects to /top?error=no_permission on 403", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("forbidden", { status: 403 })),
    );
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/users", {
      headers: { Cookie: "sso_admin_token=bad-token" },
    });

    const response = await handleAdminUsersPage(request, env);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("/top?error=no_permission");
  });

  it("still renders page when permission fetch throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error")),
    );
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/users", {
      headers: { Cookie: "sso_admin_token=some-token" },
    });

    const response = await handleAdminUsersPage(request, env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>mock admin users page</html>");
  });

  it("renders admin HTML page with correct Content-Type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("ok", { status: 200 })),
    );
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/users", {
      headers: { Cookie: "sso_admin_token=good-token" },
    });

    const response = await handleAdminUsersPage(request, env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(renderAdminUsersPage).toHaveBeenCalledOnce();
  });
});

describe("handleAdminUsersCallback", () => {
  it("returns HTML with correct Content-Type", async () => {
    const response = await handleAdminUsersCallback();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("sso_admin_token");
    expect(html).toContain("/admin/users");
  });
});
