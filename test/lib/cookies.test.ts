import { describe, it, expect } from "vitest";
import { setAuthCookie, clearAuthCookie, getAuthCookie } from "../../src/lib/cookies";

describe("cookies", () => {
  describe("setAuthCookie", () => {
    it("returns correct Set-Cookie string", () => {
      const cookie = setAuthCookie("my-jwt-token");
      expect(cookie).toBe(
        "logi_auth_token=my-jwt-token; Path=/; Max-Age=86400; Secure; SameSite=Lax",
      );
    });
  });

  describe("clearAuthCookie", () => {
    it("returns cookie string with Max-Age=0", () => {
      const cookie = clearAuthCookie();
      expect(cookie).toBe(
        "logi_auth_token=; Path=/; Max-Age=0; Secure; SameSite=Lax",
      );
    });
  });

  describe("getAuthCookie", () => {
    it("returns token from Cookie header", () => {
      const req = new Request("https://example.com", {
        headers: { Cookie: "logi_auth_token=abc123; other=value" },
      });
      expect(getAuthCookie(req)).toBe("abc123");
    });

    it("returns null when cookie not present", () => {
      const req = new Request("https://example.com", {
        headers: { Cookie: "other=value" },
      });
      expect(getAuthCookie(req)).toBeNull();
    });

    it("returns null when no Cookie header", () => {
      const req = new Request("https://example.com");
      expect(getAuthCookie(req)).toBeNull();
    });

    it("handles token with = in value", () => {
      const req = new Request("https://example.com", {
        headers: { Cookie: "logi_auth_token=abc=def; other=value" },
      });
      expect(getAuthCookie(req)).toBe("abc=def");
    });
  });
});
