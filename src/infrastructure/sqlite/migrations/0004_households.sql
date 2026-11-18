-- Several households in one database: each one has its own occupants, rooms and plants.
-- The existing household keeps id 1 and everything already stored belongs to it.

-- The household table loses its single-row constraint (nothing references it, a plain rebuild is safe).
CREATE TABLE household_new (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  session_time TEXT NOT NULL,
  timezone TEXT NOT NULL,
  summer_start TEXT NOT NULL,
  winter_start TEXT NOT NULL,
  last_reminder_date TEXT,
  group_waterings INTEGER NOT NULL DEFAULT 1
);
INSERT INTO household_new (id, name, invite_code, session_time, timezone, summer_start, winter_start, last_reminder_date, group_waterings)
SELECT id, name, invite_code, session_time, timezone, summer_start, winter_start, last_reminder_date, group_waterings FROM household;
DROP TABLE household;
ALTER TABLE household_new RENAME TO household;

ALTER TABLE occupant ADD COLUMN household_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX occupant_household ON occupant(household_id);
ALTER TABLE plant ADD COLUMN household_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX plant_household ON plant(household_id);

-- Room names are now unique within a household only. Dropping the old table sets plant.room_id
-- to NULL (ON DELETE SET NULL), so the plants' rooms are kept aside and restored afterwards.
CREATE TABLE room_new (
  id TEXT PRIMARY KEY,
  household_id INTEGER NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  UNIQUE (household_id, name)
);
INSERT INTO room_new (id, household_id, name) SELECT id, 1, name FROM room;
CREATE TABLE plant_room_backup (plant_id TEXT PRIMARY KEY, room_id TEXT NOT NULL);
INSERT INTO plant_room_backup (plant_id, room_id) SELECT id, room_id FROM plant WHERE room_id IS NOT NULL;
DROP TABLE room;
ALTER TABLE room_new RENAME TO room;
UPDATE plant SET room_id = (SELECT b.room_id FROM plant_room_backup b WHERE b.plant_id = plant.id)
WHERE id IN (SELECT plant_id FROM plant_room_backup);
DROP TABLE plant_room_backup;
