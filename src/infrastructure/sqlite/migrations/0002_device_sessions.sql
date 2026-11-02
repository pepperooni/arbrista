-- An occupant can be signed in on several devices (phone browser, installed app, computer).
CREATE TABLE device_session (
  token_hash TEXT PRIMARY KEY,
  occupant_id TEXT NOT NULL REFERENCES occupant(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

INSERT INTO device_session (token_hash, occupant_id, created_at)
SELECT token_hash, id, created_at FROM occupant WHERE token_hash IS NOT NULL AND removed_at IS NULL;

-- Short-lived, single-use codes to sign another device in as the same occupant.
CREATE TABLE device_code (
  code_hash TEXT PRIMARY KEY,
  occupant_id TEXT NOT NULL REFERENCES occupant(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
