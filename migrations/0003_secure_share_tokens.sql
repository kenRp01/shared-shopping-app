ALTER TABLE shopping_lists ADD COLUMN public_token_hash TEXT;

ALTER TABLE shopping_list_invites ADD COLUMN token_hash TEXT;
ALTER TABLE shopping_list_invites ADD COLUMN expires_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_lists_public_token_hash
  ON shopping_lists(public_token_hash)
  WHERE public_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invites_token_hash
  ON shopping_list_invites(token_hash)
  WHERE token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invites_active_expiry
  ON shopping_list_invites(list_id, enabled, expires_at);
