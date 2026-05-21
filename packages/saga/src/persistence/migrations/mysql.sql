-- @backendkit-labs/saga — MySQL migration
-- Run before using SqlAdapter with { dialect: 'mysql' }
-- Requires MySQL 8.0+ (JSON column support with functional indexes)

CREATE TABLE IF NOT EXISTS saga_states (
  id              CHAR(36)     NOT NULL,
  saga_type       VARCHAR(255) NOT NULL,
  status          VARCHAR(50)  NOT NULL,
  correlation_id  VARCHAR(255),
  steps_state     JSON         NOT NULL,
  current_step    INT          NOT NULL DEFAULT 0,
  created_at      BIGINT       NOT NULL,
  updated_at      BIGINT       NOT NULL,
  completed_at    BIGINT,
  metadata        JSON         NOT NULL,
  version         INT          NOT NULL DEFAULT 1,
  lock_expires_at BIGINT,
  PRIMARY KEY (id),
  INDEX idx_saga_states_status    (status),
  INDEX idx_saga_states_saga_type (saga_type),
  INDEX idx_saga_states_created   (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
