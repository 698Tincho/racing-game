-- The leaderboard's database (Postgres: Neon when published, Postgres.app on your Mac).
-- The API runs this itself before its first query (api/_db.ts), so a new database needs no setup.
-- Safe to run more than once: it only creates what's missing.
--   npm run db:schema         (local, .env.local)
--   npm run db:schema:prod    (Neon, .env.production)

-- Each browser's best qualifying lap on each track. No accounts: a browser is a random id it
-- keeps in localStorage, so one person doesn't fill the board, and the nickname is just a label.
create table if not exists laps (
  id          bigint generated always as identity primary key,
  track_id    text not null,                       -- the track and its physics version, e.g. 'lider-7'
  device_id   uuid not null,                       -- the browser's random id, never shown
  nickname    text not null check (char_length(nickname) between 3 and 12),
  time_ms     integer not null check (time_ms > 0),
  sectors_ms  integer[] not null,                  -- S1, S2, S3: they add up to time_ms
  car_id      text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),  -- when this browser last improved
  unique (track_id, device_id)                     -- one row per browser and track
);

-- The board: fastest first, per track.
create index if not exists laps_board_idx on laps (track_id, time_ms, updated_at);

-- Submissions, to slow down anyone hammering the API. Only a salted hash of the address is kept,
-- never the address itself, and rows go after a day.
create table if not exists lap_attempts (
  id      bigint generated always as identity primary key,
  ip_hash text not null,
  at      timestamptz not null default now()
);

create index if not exists lap_attempts_ip_idx on lap_attempts (ip_hash, at);
