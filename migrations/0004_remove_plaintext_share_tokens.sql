UPDATE shopping_lists SET public_token = NULL;

ALTER TABLE shopping_list_invites RENAME TO shopping_list_invites_legacy;

CREATE TABLE shopping_list_invites (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  expires_at TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

DROP TABLE shopping_list_invites_legacy;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_token_hash
  ON shopping_list_invites(token_hash);

CREATE INDEX IF NOT EXISTS idx_invites_active_expiry
  ON shopping_list_invites(list_id, enabled, expires_at);
