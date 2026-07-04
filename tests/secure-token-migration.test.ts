import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../migrations/0004_remove_plaintext_share_tokens.sql", import.meta.url), "utf8");

describe("secure share token migration", () => {
  it("invalidates legacy public tokens", () => {
    expect(migration).toContain("UPDATE shopping_lists SET public_token = NULL");
  });

  it("rebuilds invites without a plaintext token column", () => {
    const createTable = migration.match(/CREATE TABLE shopping_list_invites \(([\s\S]*?)\);/)?.[1] ?? "";

    expect(createTable).toContain("token_hash TEXT NOT NULL UNIQUE");
    expect(createTable).toContain("expires_at TEXT NOT NULL");
    expect(createTable).not.toMatch(/\btoken\s+TEXT/);
  });
});
