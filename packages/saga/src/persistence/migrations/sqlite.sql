-- @backendkit-labs/saga — SQLite migration
-- Run before using SqlAdapter with { dialect: 'sqlite' }
-- steps_state and metadata are stored as JSON text (SQLite has no native JSON column type)

CREATE TABLE IF NOT EXISTS saga_states (
  id              TEXT    NOT NULL PRIMARY KEY,
  saga_type       TEXT    NOT NULL,
  status          TEXT    NOT NULL,
  correlation_id  TEXT,
  steps_state     TEXT    NOT NULL DEFAULT '[]',
  current_step    INTEGER NOT NULL DEFAULT 0,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  completed_at    INTEGER,
  metadata        TEXT    NOT NULL DEFAULT '{}',
  version         INTEGER NOT NULL DEFAULT 1,
  lock_expires_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_saga_states_status    ON saga_states (status);
CREATE INDEX IF NOT EXISTS idx_saga_states_saga_type ON saga_states (saga_type);
CREATE INDEX IF NOT EXISTS idx_saga_states_created   ON saga_states (created_at DESC);
