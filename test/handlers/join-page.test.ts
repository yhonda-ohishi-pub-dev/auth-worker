import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockEnv } from "../helpers/mock-env";

const mockGetOrganizationBySlug = vi.fn();

vi.mock("@connectrpc/connect", () => ({
  createClient: vi.fn(() => ({
    getOrganizationBySlug: mockGetOrganizationBySlug,
  })),
}));

vi.mock("@yhonda-ohishi-pub-dev/logi-proto", () => ({
  AccessRequestService: {},
}));

vi.mock("../../src/lib/transport", () => ({
  createTransport: vi.fn(() => ({})),
}));

vi.mock("../../src/lib/join-html", () => ({
  renderJoinPage: vi.fn(() => "<html>mock join page</html>"),
  renderJoinNotFoundPage: vi.fn(() => "<html>mock not found</html>"),
}));

import { handleJoinPage } from "../../src/handlers/join-page";
import { renderJoinPage, renderJoinNotFoundPage } from "../../src/lib/join-html";

describe("handleJoinPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 with renderJoinNotFoundPage when org not found", async () => {
    mockGetOrganizationBySlug.mockResolvedValue({ found: false });
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/join/unknown-slug");

    const response = await handleJoinPage(request, env, "unknown-slug");

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toBe("<html>mock not found</html>");
    expect(renderJoinNotFoundPage).toHaveBeenCalledOnce();
  });

  it("returns 200 with renderJoinPage when org found", async () => {
    mockGetOrganizationBySlug.mockResolvedValue({
      found: true,
      name: "Test Org",
    });
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/join/test-org");

    const response = await handleJoinPage(request, env, "test-org");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toBe("<html>mock join page</html>");
    expect(renderJoinPage).toHaveBeenCalledWith(
      expect.objectContaining({
        orgName: "Test Org",
        orgSlug: "test-org",
        googleEnabled: true,
        authWorkerOrigin: "https://auth.test.example",
      }),
    );
  });

  it("returns 500 when gRPC call throws", async () => {
    mockGetOrganizationBySlug.mockRejectedValue(new Error("gRPC error"));
    const env = createMockEnv();
    const request = new Request("https://auth.test.example/join/error-slug");

    const response = await handleJoinPage(request, env, "error-slug");

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
  });

  it("passes googleEnabled=false when GOOGLE_CLIENT_ID is empty", async () => {
    mockGetOrganizationBySlug.mockResolvedValue({
      found: true,
      name: "No Google Org",
    });
    const env = createMockEnv({ GOOGLE_CLIENT_ID: "" });
    const request = new Request("https://auth.test.example/join/no-google");

    await handleJoinPage(request, env, "no-google");

    expect(renderJoinPage).toHaveBeenCalledWith(
      expect.objectContaining({ googleEnabled: false }),
    );
  });
});
