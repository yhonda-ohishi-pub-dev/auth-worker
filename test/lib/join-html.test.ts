import { describe, it, expect } from "vitest";
import {
  renderJoinPage,
  renderJoinNotFoundPage,
  renderJoinDonePage,
} from "../../src/lib/join-html";

describe("renderJoinPage", () => {
  it("returns a string", () => {
    const result = renderJoinPage({
      orgName: "Test Organization",
      orgSlug: "test-org",
      googleEnabled: true,
      authWorkerOrigin: "https://auth.example.com",
    });
    expect(typeof result).toBe("string");
  });

  it("contains DOCTYPE html", () => {
    const result = renderJoinPage({
      orgName: "Test Organization",
      orgSlug: "test-org",
      googleEnabled: true,
      authWorkerOrigin: "https://auth.example.com",
    });
    expect(result).toContain("<!DOCTYPE html>");
  });

  it("omits Google button when googleEnabled=false", () => {
    const result = renderJoinPage({
      orgName: "Test Org",
      orgSlug: "test-org",
      googleEnabled: false,
      authWorkerOrigin: "https://auth.example.com",
    });
    // The <a> element with Google button should not be present (CSS class may still exist in stylesheet)
    expect(result).not.toContain('href="https://auth.example.com/oauth/google/redirect');
  });

  it("contains org name and slug", () => {
    const result = renderJoinPage({
      orgName: "My Company",
      orgSlug: "my-company",
      googleEnabled: true,
      authWorkerOrigin: "https://auth.example.com",
    });
    expect(result).toContain("My Company");
    expect(result).toContain("my-company");
  });
});

describe("renderJoinNotFoundPage", () => {
  it("returns a string", () => {
    const result = renderJoinNotFoundPage();
    expect(typeof result).toBe("string");
  });

  it("contains DOCTYPE html", () => {
    const result = renderJoinNotFoundPage();
    expect(result).toContain("<!DOCTYPE html>");
  });
});

describe("renderJoinDonePage", () => {
  it("returns a string", () => {
    const result = renderJoinDonePage("test-org");
    expect(typeof result).toBe("string");
  });

  it("contains DOCTYPE html", () => {
    const result = renderJoinDonePage("test-org");
    expect(result).toContain("<!DOCTYPE html>");
  });

  it("contains the slug", () => {
    const result = renderJoinDonePage("my-org-slug");
    expect(result).toContain("my-org-slug");
  });
});
