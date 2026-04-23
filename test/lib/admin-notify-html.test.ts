import { describe, it, expect } from "vitest";
import { renderAdminNotifyPage } from "../../src/lib/admin-notify-html";

describe("renderAdminNotifyPage", () => {
  const ORIGIN = "https://alc-api.test.example";

  it("returns an HTML string", () => {
    const html = renderAdminNotifyPage(ORIGIN);
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
  });

  it("contains page title", () => {
    expect(renderAdminNotifyPage(ORIGIN)).toContain("通知管理");
  });

  it("embeds the alc-api origin via JSON.stringify", () => {
    const html = renderAdminNotifyPage(ORIGIN);
    expect(html).toContain(JSON.stringify(ORIGIN));
  });

  it("safely escapes an origin containing a quote", () => {
    const malicious = 'https://evil.test";alert(1);//';
    const html = renderAdminNotifyPage(malicious);
    expect(html).toContain(JSON.stringify(malicious));
    expect(html).not.toContain('"https://evil.test";');
  });

  it("contains 3 tabs (LINE WORKS / Recipients / Groups)", () => {
    const html = renderAdminNotifyPage(ORIGIN);
    expect(html).toContain("LINE WORKS から追加");
    expect(html).toContain("受信者一覧");
    expect(html).toContain("グループ管理");
  });

  it("uses sessionStorage auth_token + redirects to /login if missing", () => {
    const html = renderAdminNotifyPage(ORIGIN);
    expect(html).toContain("sessionStorage.getItem('auth_token')");
    expect(html).toContain("/admin/notify/callback");
  });

  it("calls the expected rust-alc-api endpoints", () => {
    const html = renderAdminNotifyPage(ORIGIN);
    expect(html).toContain("/notify/lineworks/users");
    expect(html).toContain("/notify/recipients");
    expect(html).toContain("/notify/recipients/bulk");
    expect(html).toContain("/notify/groups");
    expect(html).toContain("/notify/test-distribute");
  });

  it("renders a per-recipient テスト送信 button with rec-test class", () => {
    const html = renderAdminNotifyPage(ORIGIN);
    expect(html).toContain("rec-test");
    expect(html).toContain("テスト送信");
  });

  it("sends a fixed message template including [テスト通知] prefix", () => {
    const html = renderAdminNotifyPage(ORIGIN);
    expect(html).toContain("[テスト通知]");
    expect(html).toContain("recipient_ids: [id]");
  });

  it("prepends /api prefix when building fetch URLs (rust-alc-api routes are nested under /api)", () => {
    const html = renderAdminNotifyPage(ORIGIN);
    expect(html).toContain("ALC_API + '/api' + path");
  });

  it("shows directory.read scope guidance when LINE WORKS returns 403", () => {
    const html = renderAdminNotifyPage(ORIGIN);
    expect(html).toContain("directory.read");
  });
});
