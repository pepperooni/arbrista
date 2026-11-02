CREATE TABLE household (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  session_time TEXT NOT NULL,
  timezone TEXT NOT NULL,
  summer_start TEXT NOT NULL,
  winter_start TEXT NOT NULL,
  last_reminder_date TEXT
);

CREATE TABLE occupant (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  token_hash TEXT UNIQUE,
  created_at TEXT NOT NULL,
  removed_at TEXT
);

CREATE TABLE room (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE plant (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scientific_name TEXT,
  description TEXT,
  care TEXT NOT NULL,
  room_id TEXT REFERENCES room(id) ON DELETE SET NULL,
  summer_rhythm TEXT NOT NULL,
  winter_rhythm TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE photo (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plant(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  is_main INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE watering (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plant(id) ON DELETE CASCADE,
  occupant_id TEXT NOT NULL REFERENCES occupant(id),
  watered_at TEXT NOT NULL,
  day TEXT NOT NULL
);
CREATE INDEX watering_plant_day ON watering(plant_id, day);

CREATE TABLE push_subscription (
  id TEXT PRIMARY KEY,
  occupant_id TEXT NOT NULL REFERENCES occupant(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL
);
