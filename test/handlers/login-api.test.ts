import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockEnv } from "../helpers/mock-env";
import { createTestJwt } from "../helpers/test-jwt";

const mockLogin = vi.fn();
vi.mock("@connectrpc/connect", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@connectrpc/connect")>();
  return { ...actual, createClient: vi.fn(() => ({ login: mockLogin })) };
});
vi.mock("../../src/lib/transport", () => ({
  createTransport: vi.fn(),
}));
vi.mock("@yhonda-ohishi-pub-dev/logi-proto", () => ({
  AuthService: {},
}));

import { handleAuthLogin } from "../../src/handlers/login-api";

describe("handleAuthLogin", () => {
  const env = createMockEnv();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeRequest(fields: Record<string, string>) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);
    return new Request("https://auth.test.example/auth/login", {
      method: "POST",
      body: form,
    });
  }

  it("returns 400 for invalid redirect_uri", async () => {
    const req = makeRequest({
      username: "user",
      password: "pass",
      redirect_uri: "https://evil.com/cb",
    });
    const res = await handleAuthLogin(req, env);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing redirect_uri", async () => {
    const req = makeRequest({ username: "user", password: "pass" });
    const res = await handleAuthLogin(req, env);
    expect(res.status).toBe(400);
  });

  it("redirects to login on missing username", async () => {
    const req = makeRequest({
      redirect_uri: "https://app1.test.example/cb",
      password: "pass",
    });
    const res = await handleAuthLogin(req, env);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("/login?");
    expect(res.headers.get("Location")).toContain("error=");
  });

  it("redirects to login on missing password", async () => {
    const req = makeRequest({
      redirect_uri: "https://app1.test.example/cb",
      username: "user",
    });
    const res = await handleAuthLogin(req, env);
    expect(res.status).toBe(302);
  });

  it("redirects with JWT fragment on successful login", async () => {
    const jwt = createTestJwt({ org: "org-123" });
    mockLogin.mockResolvedValueOnce({ token: jwt, expiresAt: "9999" });

    const req = makeRequest({
      redirect_uri: "https://app1.test.example/cb",
      username: "user",
      password: "pass",
    });
    const res = await handleAuthLogin(req, env);
    expect(res.status).toBe(302);
    const loc = res.headers.get("Location")!;
    expect(loc).toContain("https://app1.test.example/cb#");
    expect(loc).toContain("token=");
    expect(loc).toContain("org_id=org-123");
  });

  it("redirects with JWT when token has no dots (no payload)", async () => {
    mockLogin.mockResolvedValueOnce({ token: "nodots", expiresAt: "9999" });

    const req = makeRequest({
      redirect_uri: "https://app1.test.example/cb",
      username: "user",
      password: "pass",
    });
    const res = await handleAuthLogin(req, env);
    expect(res.status).toBe(302);
    // org_id should not be in fragment since no payload
    expect(res.headers.get("Location")).not.toContain("org_id=");
  });

  it("redirects with JWT even when payload decode fails", async () => {
    mockLogin.mockResolvedValueOnce({ token: "bad.!!!.jwt", expiresAt: "9999" });

    const req = makeRequest({
      redirect_uri: "https://app1.test.example/cb",
      username: "user",
      password: "pass",
    });
    const res = await handleAuthLogin(req, env);
    expect(res.status).toBe(302);
    const loc = res.headers.get("Location")!;
    expect(loc).toContain("token=bad.%21%21%21.jwt");
  });

  it("includes org_id in redirect on login with organization_id", async () => {
    const jwt = createTestJwt({ org: "org-456" });
    mockLogin.mockResolvedValueOnce({ token: jwt, expiresAt: "9999" });

    const req = makeRequest({
      redirect_uri: "https://app1.test.example/cb",
      username: "user",
      password: "pass",
      organization_id: "org-456",
    });
    const res = await handleAuthLogin(req, env);
    expect(res.status).toBe(302);
    expect(mockLogin).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: "org-456" }),
    );
  });

  it("redirects to login on ConnectError", async () => {
    const { ConnectError } = await import("@connectrpc/connect");
    mockLogin.mockRejectedValueOnce(new ConnectError("Invalid credentials", 16));

    const req = makeRequest({
      redirect_uri: "https://app1.test.example/cb",
      username: "user",
      password: "wrong",
    });
    const res = await handleAuthLogin(req, env);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("error=");
  });

  it("redirects to login with org_id on ConnectError when org_id was provided", async () => {
    const { ConnectError } = await import("@connectrpc/connect");
    mockLogin.mockRejectedValueOnce(new ConnectError("fail", 16));

    const req = makeRequest({
      redirect_uri: "https://app1.test.example/cb",
      username: "user",
      password: "wrong",
      organization_id: "my-org",
    });
    const res = await handleAuthLogin(req, env);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain("org_id=my-org");
  });

  it("throws non-ConnectError errors", async () => {
    mockLogin.mockRejectedValueOnce(new Error("network failure"));

    const req = makeRequest({
      redirect_uri: "https://app1.test.example/cb",
      username: "user",
      password: "pass",
    });
    await expect(handleAuthLogin(req, env)).rejects.toThrow("network failure");
  });
});
