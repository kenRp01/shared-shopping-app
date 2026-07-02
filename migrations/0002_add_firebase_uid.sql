ALTER TABLE profiles ADD COLUMN firebase_uid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_firebase_uid
  ON profiles(firebase_uid)
  WHERE firebase_uid IS NOT NULL;
