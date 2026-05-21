-- @backendkit-labs/saga — PostgreSQL schema
-- Run this migration before using PostgresSagaStore.

CREATE TABLE IF NOT EXISTS saga_states (
  id              VARCHAR(36)  PRIMARY KEY,
  saga_type       VARCHAR(255) NOT NULL,
  status          VARCHAR(50)  NOT NULL,
  correlation_id  VARCHAR(255),
  steps_state     JSONB        NOT NULL DEFAULT '[]',
  current_step    INTEGER      NOT NULL DEFAULT 0,
  created_at      BIGINT       NOT NULL,
  updated_at      BIGINT       NOT NULL,
  completed_at    BIGINT,
  metadata        JSONB        NOT NULL DEFAULT '{}',
  version         INTEGER      NOT NULL DEFAULT 1,
  lock_expires_at BIGINT
);

CREATE INDEX IF NOT EXISTS idx_saga_states_status    ON saga_states (status);
CREATE INDEX IF NOT EXISTS idx_saga_states_saga_type ON saga_states (saga_type);
CREATE INDEX IF NOT EXISTS idx_saga_states_created   ON saga_states (created_at DESC);
