import { describe, it, expect } from "vitest";
import { renderAdminUsersPage } from "../../src/lib/admin-users-html";

describe("renderAdminUsersPage", () => {
  it("returns a string", () => {
    const result = renderAdminUsersPage();
    expect(typeof result).toBe("string");
  });

  it("contains DOCTYPE html", () => {
    const result = renderAdminUsersPage();
    expect(result).toContain("<!DOCTYPE html>");
  });

  it("has non-empty content", () => {
    const result = renderAdminUsersPage();
    expect(result.length).toBeGreaterThan(100);
  });
});
