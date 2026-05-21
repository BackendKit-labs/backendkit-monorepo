// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/persistence/sql-adapter.ts
//
// SQL SagaStore adapter — covers PostgreSQL, MySQL, and SQLite from a single
// implementation. The dialect controls placeholder syntax only; the schema
// and query logic are identical across all three engines.
//
// Usage:
//   new SqlAdapter(client, { dialect: 'postgres' })
//   new SqlAdapter(client, { dialect: 'mysql' })
//   new SqlAdapter(client, { dialect: 'sqlite' })
//
// Run the matching migration before first use:
//   src/persistence/migrations/postgres.sql
//   src/persistence/migrations/mysql.sql
//   src/persistence/migrations/sqlite.sql
// ---------------------------------------------------------------------------

import { ok, fail } from '@backendkit-labs/result';
import type { SagaState, SagaFilter, SagaId } from '../types/saga.types';
import type { SagaResult } from '../types/error.types';
import type { SagaStore } from './saga-store.interface';

// ---- Dialect ----

export type SqlDialect = 'postgres' | 'mysql' | 'sqlite';

// ---- Duck-typed SQL client ----
//
// Any driver can be wrapped to satisfy this interface:
//
//   Postgres (pg):
//     { query: (sql, params) => pool.query(sql, params).then(r => ({
//         rows: r.rows, affectedRows: r.rowCount ?? 0
//       })) }
//
//   MySQL (mysql2):
//     { query: (sql, params) => conn.execute(sql, params).then(([r]) => ({
//         rows: Array.isArray(r) ? r : [], affectedRows: (r as any).affectedRows ?? 0
//       })) }
//
//   SQLite (better-sqlite3 wrapped in async):
//     { query: (sql, params) => Promise.resolve({
//         rows: db.prepare(sql).all(params), affectedRows: db.prepare(sql).run(params).changes
//       }) }

export interface SqlClient {
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{
    rows: Record<string, unknown>[];
    affectedRows?: number;
  }>;
}

// ---- Options ----

export interface SqlAdapterOptions {
  dialect: SqlDialect;
}

// ---- Row shape (internal) ----

interface SagaRow extends Record<string, unknown> {
  id: string;
  saga_type: string;
  status: string;
  correlation_id: string | null;
  steps_state: unknown;
  current_step: number | string;
  created_at: number | string;
  updated_at: number | string;
  completed_at: number | string | null;
  metadata: unknown;
  version: number | string;
  lock_expires_at: number | string | null;
}

// ---- Implementation ----

export class SqlAdapter implements SagaStore {
  private readonly dialect: SqlDialect;

  constructor(
    private readonly client: SqlClient,
    options: SqlAdapterOptions,
  ) {
    this.dialect = options.dialect;
  }

  async save(state: SagaState): Promise<SagaResult<void>> {
    try {
      const existing = await this.client.query(
        `SELECT version, status FROM saga_states WHERE id = ${this.p(1)}`,
        [state.id],
      );

      if (existing.rows.length === 0) {
        await this.client.query(
          `INSERT INTO saga_states
             (id, saga_type, status, correlation_id, steps_state, current_step,
              created_at, updated_at, completed_at, metadata, version, lock_expires_at)
           VALUES (${this.placeholders(12)})`,
          [
            state.id,
            state.sagaType,
            state.status,
            state.correlationId ?? null,
            JSON.stringify(state.steps),
            state.currentStepIndex,
            state.createdAt,
            state.updatedAt,
            state.completedAt ?? null,
            JSON.stringify(state.metadata),
            state.version,
            state.lockExpiresAt ?? null,
          ],
        );
      } else {
        const prev = existing.rows[0] as { version: number; status: string };
        if (Number(prev.version) !== state.version - 1) {
          return fail({
            category: 'PERSISTENCE_ERROR',
            cause: new Error(
              `Version conflict for saga ${state.id}: expected ${state.version - 1}, got ${prev.version}`,
            ),
          });
        }

        await this.client.query(
          `UPDATE saga_states
              SET saga_type       = ${this.p(1)},
                  status          = ${this.p(2)},
                  correlation_id  = ${this.p(3)},
                  steps_state     = ${this.p(4)},
                  current_step    = ${this.p(5)},
                  updated_at      = ${this.p(6)},
                  completed_at    = ${this.p(7)},
                  metadata        = ${this.p(8)},
                  version         = ${this.p(9)},
                  lock_expires_at = ${this.p(10)}
            WHERE id = ${this.p(11)} AND version = ${this.p(12)}`,
          [
            state.sagaType,
            state.status,
            state.correlationId ?? null,
            JSON.stringify(state.steps),
            state.currentStepIndex,
            state.updatedAt,
            state.completedAt ?? null,
            JSON.stringify(state.metadata),
            state.version,
            state.lockExpiresAt ?? null,
            state.id,
            state.version - 1,
          ],
        );
      }

      return ok(undefined);
    } catch (err) {
      return fail({
        category: 'PERSISTENCE_ERROR',
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  async load(sagaId: SagaId): Promise<SagaResult<SagaState>> {
    try {
      const result = await this.client.query(
        `SELECT * FROM saga_states WHERE id = ${this.p(1)}`,
        [sagaId],
      );

      if (result.rows.length === 0) {
        return fail({ category: 'SAGA_NOT_FOUND', sagaId });
      }

      return ok(rowToState(result.rows[0] as SagaRow));
    } catch (err) {
      return fail({
        category: 'PERSISTENCE_ERROR',
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  async list(filter?: SagaFilter): Promise<SagaResult<SagaState[]>> {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let idx = 1;

      if (filter?.status !== undefined) {
        conditions.push(`status = ${this.p(idx++)}`);
        params.push(filter.status);
      }
      if (filter?.sagaType !== undefined) {
        conditions.push(`saga_type = ${this.p(idx++)}`);
        params.push(filter.sagaType);
      }
      if (filter?.createdAfter !== undefined) {
        conditions.push(`created_at >= ${this.p(idx++)}`);
        params.push(filter.createdAfter);
      }
      if (filter?.createdBefore !== undefined) {
        conditions.push(`created_at <= ${this.p(idx++)}`);
        params.push(filter.createdBefore);
      }

      const where  = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit  = filter?.limit  !== undefined ? `LIMIT ${this.p(idx++)}` : '';
      const offset = filter?.offset !== undefined ? `OFFSET ${this.p(idx++)}` : '';

      if (filter?.limit  !== undefined) params.push(filter.limit);
      if (filter?.offset !== undefined) params.push(filter.offset);

      const sql = `SELECT * FROM saga_states ${where} ORDER BY created_at DESC ${limit} ${offset}`.trimEnd();
      const result = await this.client.query(sql, params);

      return ok(result.rows.map((r) => rowToState(r as SagaRow)));
    } catch (err) {
      return fail({
        category: 'PERSISTENCE_ERROR',
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  async delete(sagaId: SagaId): Promise<SagaResult<void>> {
    try {
      const result = await this.client.query(
        `DELETE FROM saga_states WHERE id = ${this.p(1)}`,
        [sagaId],
      );

      if (result.affectedRows !== undefined && result.affectedRows === 0) {
        return fail({ category: 'SAGA_NOT_FOUND', sagaId });
      }

      return ok(undefined);
    } catch (err) {
      return fail({
        category: 'PERSISTENCE_ERROR',
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  // ---- Placeholder helpers ----

  private p(index: number): string {
    return this.dialect === 'postgres' ? `$${index}` : '?';
  }

  private placeholders(count: number): string {
    return Array.from({ length: count }, (_, i) => this.p(i + 1)).join(', ');
  }
}

// ---- Row → SagaState ----

function rowToState(row: SagaRow): SagaState {
  return {
    id: row.id as SagaId,
    sagaType: row.saga_type,
    status: row.status as SagaState['status'],
    correlationId: row.correlation_id ?? '',
    steps: typeof row.steps_state === 'string'
      ? (JSON.parse(row.steps_state) as SagaState['steps'])
      : (row.steps_state as SagaState['steps']),
    currentStepIndex: Number(row.current_step),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    completedAt: row.completed_at !== null ? Number(row.completed_at) : undefined,
    metadata: typeof row.metadata === 'string'
      ? (JSON.parse(row.metadata) as Record<string, unknown>)
      : (row.metadata as Record<string, unknown>),
    version: Number(row.version),
    lockExpiresAt: row.lock_expires_at !== null ? Number(row.lock_expires_at) : undefined,
  };
}
