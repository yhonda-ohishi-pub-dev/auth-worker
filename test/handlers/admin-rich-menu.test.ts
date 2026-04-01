import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockEnv } from "../helpers/mock-env";

vi.mock("../../src/lib/admin-rich-menu-html", () => ({
  renderAdminRichMenuPage: vi.fn(() => "<html>mock rich menu page</html>"),
}));

import {
  handleAdminRichMenuPage,
  handleAdminRichMenuCallback,
} from "../../src/handlers/admin-rich-menu";
import { renderAdminRichMenuPage } from "../../src/lib/admin-rich-menu-html";

describe("handleAdminRichMenuPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login when no cookie", async () => {
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/rich-menu");

    const response = await handleAdminRichMenuPage(request, env);

    expect(response.status).toBe(302);
    const location = response.headers.get("Location");
    expect(location).toContain("/login?redirect_uri=");
    expect(location).toContain(encodeURIComponent("/admin/rich-menu/callback"));
  });

  it("uses sso_admin_token cookie when present", async () => {
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/rich-menu", {
      headers: { Cookie: "sso_admin_token=admin-jwt-123" },
    });

    const response = await handleAdminRichMenuPage(request, env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>mock rich menu page</html>");
  });

  it("falls back to logi_auth_token cookie", async () => {
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/rich-menu", {
      headers: { Cookie: "logi_auth_token=shared-jwt-456" },
    });

    const response = await handleAdminRichMenuPage(request, env);

    expect(response.status).toBe(200);
    expect(renderAdminRichMenuPage).toHaveBeenCalledOnce();
  });

  it("renders admin HTML page with correct Content-Type", async () => {
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/rich-menu", {
      headers: { Cookie: "sso_admin_token=good-token" },
    });

    const response = await handleAdminRichMenuPage(request, env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
  });
});

describe("handleAdminRichMenuCallback", () => {
  it("returns HTML with correct Content-Type", async () => {
    const response = await handleAdminRichMenuCallback();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("sso_admin_token");
    expect(html).toContain("/admin/rich-menu");
  });
});
