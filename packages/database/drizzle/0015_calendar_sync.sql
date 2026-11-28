CREATE TABLE IF NOT EXISTS google_calendar_sync (
  compromisso_id TEXT PRIMARY KEY NOT NULL REFERENCES compromissos(id),
  state_json TEXT NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS google_calendar_sync_lease (
  id TEXT PRIMARY KEY NOT NULL, owner TEXT NOT NULL, expires_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_compromissos_google_event_id ON compromissos(google_event_id);
