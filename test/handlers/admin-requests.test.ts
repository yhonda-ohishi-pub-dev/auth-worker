import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockEnv } from "../helpers/mock-env";

const mockListAccessRequests = vi.fn();

vi.mock("@connectrpc/connect", () => ({
  createClient: vi.fn(() => ({
    listAccessRequests: mockListAccessRequests,
  })),
  ConnectError: class ConnectError extends Error {
    code: number;
    constructor(message: string, code: number) {
      super(message);
      this.code = code;
    }
  },
  Code: { PermissionDenied: 7 },
}));

vi.mock("@yhonda-ohishi-pub-dev/logi-proto", () => ({
  AccessRequestService: {},
}));

vi.mock("../../src/lib/transport", () => ({
  createTransportWithAuth: vi.fn(() => ({})),
}));

vi.mock("../../src/lib/admin-requests-html", () => ({
  renderAdminRequestsPage: vi.fn(() => "<html>mock admin requests page</html>"),
}));

// We need to re-import ConnectError from our mock to throw proper instances
import { ConnectError, Code } from "@connectrpc/connect";
import {
  handleAdminRequestsPage,
  handleAdminRequestsCallback,
} from "../../src/handlers/admin-requests";
import { renderAdminRequestsPage } from "../../src/lib/admin-requests-html";

describe("handleAdminRequestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login when no cookie", async () => {
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/requests");

    const response = await handleAdminRequestsPage(request, env);

    expect(response.status).toBe(302);
    const location = response.headers.get("Location");
    expect(location).toContain("/login?redirect_uri=");
    expect(location).toContain(encodeURIComponent("/admin/requests/callback"));
  });

  it("uses sso_admin_token cookie when present", async () => {
    mockListAccessRequests.mockResolvedValue({ requests: [] });
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/requests", {
      headers: { Cookie: "sso_admin_token=admin-jwt-123" },
    });

    const response = await handleAdminRequestsPage(request, env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>mock admin requests page</html>");
  });

  it("falls back to logi_auth_token cookie", async () => {
    mockListAccessRequests.mockResolvedValue({ requests: [] });
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/requests", {
      headers: { Cookie: "logi_auth_token=shared-jwt-456" },
    });

    const response = await handleAdminRequestsPage(request, env);

    expect(response.status).toBe(200);
    expect(renderAdminRequestsPage).toHaveBeenCalledOnce();
  });

  it("redirects to /top?error=no_permission on PermissionDenied", async () => {
    mockListAccessRequests.mockRejectedValue(
      new ConnectError("permission denied", Code.PermissionDenied),
    );
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/requests", {
      headers: { Cookie: "sso_admin_token=bad-token" },
    });

    const response = await handleAdminRequestsPage(request, env);

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("/top?error=no_permission");
  });

  it("still renders page when permission check throws non-ConnectError", async () => {
    mockListAccessRequests.mockRejectedValue(new Error("network error"));
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/requests", {
      headers: { Cookie: "sso_admin_token=some-token" },
    });

    const response = await handleAdminRequestsPage(request, env);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("<html>mock admin requests page</html>");
  });

  it("renders admin HTML page with correct Content-Type", async () => {
    mockListAccessRequests.mockResolvedValue({ requests: [] });
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/admin/requests", {
      headers: { Cookie: "sso_admin_token=good-token" },
    });

    const response = await handleAdminRequestsPage(request, env);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
  });
});

describe("handleAdminRequestsCallback", () => {
  it("returns HTML with correct Content-Type", async () => {
    const response = await handleAdminRequestsCallback();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("sso_admin_token");
    expect(html).toContain("/admin/requests");
  });
});
