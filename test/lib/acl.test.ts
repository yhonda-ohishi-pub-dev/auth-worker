import { describe, it, expect, beforeEach } from "vitest";
import { checkOrgAccess, isTenantInOrgAllowlist } from "../../src/lib/acl";
import { _clearAllowedOriginsCache } from "../../src/lib/config";
import { createMockEnv, createMockKV } from "../helpers/mock-env";

const OHISHI_ACL = JSON.stringify({ "ohishi-exp": ["tenant-a", "tenant-b"] });
const APP_ORGS = JSON.stringify({ "dtako-admin": "ohishi-exp", ohishi2: "ohishi-exp" });

describe("checkOrgAccess", () => {
  beforeEach(() => {
    _clearAllowedOriginsCache();
  });

  it("bypasses ACL for worktree origins regardless of tenant_id", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({
        "origins:wt": "https://wt.trycloudflare.com",
        "app-orgs": APP_ORGS,
      }),
      TENANT_ACL: OHISHI_ACL,
    });

    expect(await checkOrgAccess(env, "https://wt.trycloudflare.com", "")).toBe(true);
    expect(await checkOrgAccess(env, "https://wt.trycloudflare.com", "unknown-tenant")).toBe(true);
  });

  it("allows ippoan (default) origins for any tenant", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({ "app-orgs": APP_ORGS }),
      TENANT_ACL: OHISHI_ACL,
    });

    expect(await checkOrgAccess(env, "https://alc-app.example", "")).toBe(true);
    expect(await checkOrgAccess(env, "https://anyapp.example", "random")).toBe(true);
  });

  it("allows ohishi-exp origin when tenant_id is in TENANT_ACL", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({ "app-orgs": APP_ORGS }),
      TENANT_ACL: OHISHI_ACL,
    });

    expect(await checkOrgAccess(env, "https://dtako-admin.example", "tenant-a")).toBe(true);
    expect(await checkOrgAccess(env, "https://ohishi2.example", "tenant-b")).toBe(true);
  });

  it("denies ohishi-exp origin when tenant_id is empty", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({ "app-orgs": APP_ORGS }),
      TENANT_ACL: OHISHI_ACL,
    });

    expect(await checkOrgAccess(env, "https://dtako-admin.example", "")).toBe(false);
  });

  it("denies ohishi-exp origin when tenant_id is not in allowlist", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({ "app-orgs": APP_ORGS }),
      TENANT_ACL: OHISHI_ACL,
    });

    expect(await checkOrgAccess(env, "https://dtako-admin.example", "tenant-z")).toBe(false);
  });

  it("denies ohishi-exp when TENANT_ACL is missing (fail-closed)", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({ "app-orgs": APP_ORGS }),
    });

    expect(await checkOrgAccess(env, "https://dtako-admin.example", "tenant-a")).toBe(false);
  });

  it("denies ohishi-exp when TENANT_ACL is malformed JSON (fail-closed)", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({ "app-orgs": APP_ORGS }),
      TENANT_ACL: "not-json",
    });

    expect(await checkOrgAccess(env, "https://dtako-admin.example", "tenant-a")).toBe(false);
  });

  it("allows when app-orgs KV is missing (origin treated as ippoan)", async () => {
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({}),
      TENANT_ACL: OHISHI_ACL,
    });

    expect(await checkOrgAccess(env, "https://dtako-admin.example", "")).toBe(true);
  });

  it("wt bypass wins over ohishi-exp classification", async () => {
    // An origin that is BOTH registered as wt AND matches an ohishi-exp token.
    const env = createMockEnv({
      AUTH_CONFIG: createMockKV({
        "origins:wt": "https://dtako-admin-wt.trycloudflare.com",
        "app-orgs": APP_ORGS,
      }),
      TENANT_ACL: OHISHI_ACL,
    });

    expect(await checkOrgAccess(env, "https://dtako-admin-wt.trycloudflare.com", "")).toBe(true);
  });
});

describe("isTenantInOrgAllowlist", () => {
  it("returns true when tenant is listed under the org", () => {
    const env = createMockEnv({ TENANT_ACL: OHISHI_ACL });
    expect(isTenantInOrgAllowlist(env, "ohishi-exp", "tenant-a")).toBe(true);
  });

  it("returns false for empty tenant_id", () => {
    const env = createMockEnv({ TENANT_ACL: OHISHI_ACL });
    expect(isTenantInOrgAllowlist(env, "ohishi-exp", "")).toBe(false);
  });

  it("returns false when org is not in the ACL", () => {
    const env = createMockEnv({ TENANT_ACL: OHISHI_ACL });
    expect(isTenantInOrgAllowlist(env, "other-org", "tenant-a")).toBe(false);
  });

  it("returns false when TENANT_ACL is missing", () => {
    const env = createMockEnv();
    expect(isTenantInOrgAllowlist(env, "ohishi-exp", "tenant-a")).toBe(false);
  });

  it("returns false when TENANT_ACL value for org is not an array", () => {
    const env = createMockEnv({ TENANT_ACL: JSON.stringify({ "ohishi-exp": "not-array" }) });
    expect(isTenantInOrgAllowlist(env, "ohishi-exp", "tenant-a")).toBe(false);
  });
});
