PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS shopping_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  planned_date TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shared', 'public_link')),
  owner_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  public_token TEXT UNIQUE,
  daily_reminder_enabled INTEGER NOT NULL DEFAULT 1 CHECK (daily_reminder_enabled IN (0, 1)),
  daily_reminder_hour TEXT NOT NULL DEFAULT '08:00',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS shopping_list_members (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor')),
  invited_by_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (list_id, user_id)
);

CREATE TABLE IF NOT EXISTS shopping_items (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  quantity TEXT NOT NULL DEFAULT '1',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'purchased')),
  scope TEXT NOT NULL DEFAULT 'shared' CHECK (scope IN ('shared', 'personal')),
  due_date TEXT,
  due_time TEXT,
  remind_on TEXT,
  reminder_enabled INTEGER NOT NULL DEFAULT 1 CHECK (reminder_enabled IN (0, 1)),
  created_by_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  updated_by_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  purchased_by_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS reminder_delivery_logs (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  delivery_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'skipped')),
  sent_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (list_id, delivery_date)
);

CREATE TABLE IF NOT EXISTS shopping_list_invites (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_by_user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_owner ON shopping_lists(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_public_token ON shopping_lists(public_token);
CREATE INDEX IF NOT EXISTS idx_shopping_list_members_list ON shopping_list_members(list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_members_user ON shopping_list_members(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON shopping_items(list_id);
CREATE INDEX IF NOT EXISTS idx_shopping_items_due ON shopping_items(due_date);
CREATE INDEX IF NOT EXISTS idx_shopping_items_remind_on ON shopping_items(remind_on);
CREATE INDEX IF NOT EXISTS idx_shopping_items_status_scope ON shopping_items(status, scope);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_list_date ON reminder_delivery_logs(list_id, delivery_date);
CREATE INDEX IF NOT EXISTS idx_invites_token ON shopping_list_invites(token);
