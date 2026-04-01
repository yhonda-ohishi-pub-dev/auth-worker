import { describe, it, expect } from "vitest";
import { renderAdminRequestsPage } from "../../src/lib/admin-requests-html";

describe("renderAdminRequestsPage", () => {
  it("returns a string", () => {
    const result = renderAdminRequestsPage();
    expect(typeof result).toBe("string");
  });

  it("contains DOCTYPE html", () => {
    const result = renderAdminRequestsPage();
    expect(result).toContain("<!DOCTYPE html>");
  });

  it("has non-empty content", () => {
    const result = renderAdminRequestsPage();
    expect(result.length).toBeGreaterThan(100);
  });
});
