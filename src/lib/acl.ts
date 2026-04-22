/**
 * Org-based access control.
 *
 * Combines three KV/secret inputs to decide whether a given tenant may
 * access a given origin URL:
 *
 *   - `origins:wt` (KV) — ephemeral worktree tunnels, always bypass ACL
 *   - `app-orgs` (KV JSON) — origin URL → github-org classification
 *   - `TENANT_ACL` (Worker secret JSON) — per-org allowlisted tenant_ids
 *
 * Used by /top (tile filtering) and the OAuth callback handlers (redirect
 * authorization).
 */

import type { Env } from "../index";
import { classifyOrigin, isWorktreeOrigin } from "./config";

/**
 * Returns true iff `tenantId` is allowed to access `origin`.
 *
 * - wt-registered tunnels: always allowed (dev bypass)
 * - ippoan / unclassified origins: always allowed
 * - ohishi-exp origins: allowed only when tenantId is in TENANT_ACL["ohishi-exp"]
 *
 * Missing or malformed TENANT_ACL is treated as `{}` (fail-closed: every
 * ohishi-exp access is denied).
 */
export async function checkOrgAccess(
  env: Env,
  origin: string,
  tenantId: string,
): Promise<boolean> {
  if (await isWorktreeOrigin(env, origin)) return true;

  const org = await classifyOrigin(env, origin);
  if (org !== "ohishi-exp") return true;

  if (!tenantId) return false;
  const allowed = allowlistFor(env, "ohishi-exp");
  return allowed.includes(tenantId);
}

/**
 * Synchronous ACL lookup — assumes the caller already knows the origin's
 * org. Used by /top where classify results are already in hand.
 */
export function isTenantInOrgAllowlist(
  env: Env,
  org: string,
  tenantId: string,
): boolean {
  if (!tenantId) return false;
  return allowlistFor(env, org).includes(tenantId);
}

function allowlistFor(env: Env, org: string): string[] {
  if (!env.TENANT_ACL) return [];
  try {
    const parsed = JSON.parse(env.TENANT_ACL) as Record<string, string[]>;
    const list = parsed[org];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
