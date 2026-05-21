#!/usr/bin/env node
// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/cli/index.ts
//
// Dev CLI for inspecting and managing sagas.
//
// Usage:
//   npx saga-cli list [--status <status>] [--type <type>] [--limit <n>]
//   npx saga-cli inspect <sagaId>
//   npx saga-cli pause <sagaId>
//   npx saga-cli resume <sagaId>
//
// Configuration via env vars:
//   SAGA_DB_URL      — DB connection string (postgres/mysql/sqlite)
//   SAGA_DB_DIALECT  — "postgres" (default), "mysql", or "sqlite"
//   SAGA_PG_URL      — alias for SAGA_DB_URL (backwards compat)
// ---------------------------------------------------------------------------

import { SagaEngine } from '../core/saga-engine';
import { SqlAdapter } from '../persistence/sql-adapter';
import { InMemoryLock } from '../lock/in-memory-lock';
import { SagaEventBusImpl } from '../events/saga-event-bus';
import { isOk } from '@backendkit-labs/result';
import type { SagaId } from '../types/saga.types';

// ---- Arg parsing (no external deps) ----

interface ParsedArgs {
  command: string;
  sagaId?: string;
  flags: Record<string, string>;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const command = args[0] ?? 'help';
  const sagaId = !args[1]?.startsWith('--') ? args[1] : undefined;
  const flags: Record<string, string> = {};

  for (let i = sagaId !== undefined ? 2 : 1; i < args.length; i++) {
    const arg = args[i];
    if (arg?.startsWith('--')) {
      const [key, val] = arg.slice(2).split('=');
      flags[key ?? ''] = val ?? args[++i] ?? 'true';
    }
  }

  return { command, sagaId, flags };
}

// ---- DB client factory ----

type SqlDialect = import('../persistence/sql-adapter').SqlDialect;
type SqlClient = import('../persistence/sql-adapter').SqlClient;

async function createDbClient(url: string, dialect: SqlDialect): Promise<SqlClient> {
  if (dialect === 'postgres') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pg = await import('pg' as any).catch(() => {
      throw new Error('pg is not installed. Run: npm install pg');
    }) as { default: { Pool: new (opts: { connectionString: string }) => { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }> } } };
    const pool = new pg.default.Pool({ connectionString: url });
    return {
      query: async (sql, params) => {
        const result = await pool.query(sql, params);
        return { rows: result.rows, affectedRows: result.rowCount ?? 0 };
      },
    };
  }

  if (dialect === 'mysql') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mysql = await import('mysql2/promise' as any).catch(() => {
      throw new Error('mysql2 is not installed. Run: npm install mysql2');
    }) as { default: { createPool(url: string): { query(sql: string, params?: unknown[]): Promise<[Record<string, unknown>[], { affectedRows: number }]> } } };
    const pool = mysql.default.createPool(url);
    return {
      query: async (sql, params) => {
        const [rows, meta] = await pool.query(sql, params);
        return { rows: rows as Record<string, unknown>[], affectedRows: (meta as { affectedRows: number }).affectedRows };
      },
    };
  }

  // sqlite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sqlite = await import('better-sqlite3' as any).catch(() => {
    throw new Error('better-sqlite3 is not installed. Run: npm install better-sqlite3');
  }) as { default: new (path: string) => { prepare(sql: string): { all(...params: unknown[]): Record<string, unknown>[]; run(...params: unknown[]): { changes: number } } } };
  const db = new sqlite.default(url.replace(/^sqlite:\/\//, ''));
  return {
    query: async (sql, params) => {
      const stmt = db.prepare(sql);
      const isSelect = /^\s*SELECT/i.test(sql);
      if (isSelect) {
        const rows = params !== undefined ? stmt.all(...params) : stmt.all();
        return { rows, affectedRows: 0 };
      }
      const info = params !== undefined ? stmt.run(...params) : stmt.run();
      return { rows: [], affectedRows: info.changes };
    },
  };
}

// ---- Commands ----

async function cmdList(engine: SagaEngine, flags: Record<string, string>): Promise<void> {
  const filter = {
    status: flags['status'] as never,
    sagaType: flags['type'],
    limit: flags['limit'] !== undefined ? parseInt(flags['limit'], 10) : 20,
    offset: flags['offset'] !== undefined ? parseInt(flags['offset'], 10) : 0,
  };

  const result = await engine.list(filter);
  if (!isOk(result)) {
    console.error('Error listing sagas:', result.error);
    process.exit(1);
  }

  const sagas = result.value;
  if (sagas.length === 0) {
    console.log('No sagas found.');
    return;
  }

  const rows = sagas.map((s) => ({
    id: s.id.slice(0, 8) + '…',
    type: s.sagaType,
    status: s.status,
    steps: `${s.currentStepIndex + 1}/${s.steps.length}`,
    updated: new Date(s.updatedAt).toISOString(),
  }));

  console.table(rows);
  console.log(`\nShowing ${sagas.length} sagas.`);
}

async function cmdInspect(engine: SagaEngine, sagaId: string): Promise<void> {
  const result = await engine.getStatus(sagaId as SagaId);
  if (!isOk(result)) {
    console.error('Saga not found:', sagaId);
    process.exit(1);
  }

  const state = result.value;
  console.log('\n── Saga State ─────────────────────────────');
  console.log(`  ID:            ${state.id}`);
  console.log(`  Type:          ${state.sagaType}`);
  console.log(`  Status:        ${state.status}`);
  console.log(`  CorrelationId: ${state.correlationId}`);
  console.log(`  Version:       ${state.version}`);
  console.log(`  Created:       ${new Date(state.createdAt).toISOString()}`);
  console.log(`  Updated:       ${new Date(state.updatedAt).toISOString()}`);
  if (state.completedAt !== undefined) {
    console.log(`  Completed:     ${new Date(state.completedAt).toISOString()}`);
  }
  console.log('\n── Steps ───────────────────────────────────');
  state.steps.forEach((step, i) => {
    const marker = i === state.currentStepIndex ? '→' : ' ';
    console.log(`  ${marker} [${i + 1}] ${step.name.padEnd(30)} ${step.status} (attempt ${step.attempt})`);
    if (step.error !== undefined) {
      console.log(`        Error: ${JSON.stringify(step.error)}`);
    }
  });
  console.log('');
}

async function cmdPause(engine: SagaEngine, sagaId: string): Promise<void> {
  const result = await engine.pause(sagaId as SagaId);
  if (!isOk(result)) {
    console.error('Failed to pause saga:', result.error);
    process.exit(1);
  }
  console.log(`✓ Saga ${sagaId} paused.`);
}

async function cmdResume(engine: SagaEngine, sagaId: string): Promise<void> {
  const result = await engine.resume(sagaId as SagaId);
  if (!isOk(result)) {
    console.error('Failed to resume saga:', result.error);
    process.exit(1);
  }
  console.log(`✓ Saga ${sagaId} resumed — status: ${result.value.status}`);
}

function printHelp(): void {
  console.log(`
@backendkit-labs/saga CLI

Usage:
  saga-cli <command> [options]

Commands:
  list              List sagas
    --status <s>    Filter by status (RUNNING, COMPLETED, FAILED, PAUSED, ...)
    --type <t>      Filter by saga type
    --limit <n>     Max results (default: 20)
    --offset <n>    Skip first N results

  inspect <sagaId>  Show full saga state and step details
  pause   <sagaId>  Pause a running saga
  resume  <sagaId>  Resume a paused saga

Environment:
  SAGA_DB_URL       Database connection string (required)
                    Postgres:  postgresql://user:pass@localhost:5432/mydb
                    MySQL:     mysql://user:pass@localhost:3306/mydb
                    SQLite:    sqlite:///path/to/saga.db  (or just a file path)
  SAGA_DB_DIALECT   Database dialect: postgres (default), mysql, sqlite
  SAGA_PG_URL       Alias for SAGA_DB_URL (postgres, kept for backwards compat)
`);
}

// ---- Main ----

async function main(): Promise<void> {
  const { command, sagaId, flags } = parseArgs(process.argv);

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  // SAGA_DB_URL is preferred; SAGA_PG_URL kept for backwards compatibility
  const dbUrl = process.env['SAGA_DB_URL'] ?? process.env['SAGA_PG_URL'];
  if (dbUrl === undefined || dbUrl === '') {
    console.error('Error: SAGA_DB_URL environment variable is required.\n');
    printHelp();
    process.exit(1);
  }

  const rawDialect = process.env['SAGA_DB_DIALECT'] ?? 'postgres';
  if (rawDialect !== 'postgres' && rawDialect !== 'mysql' && rawDialect !== 'sqlite') {
    console.error(`Error: SAGA_DB_DIALECT must be "postgres", "mysql", or "sqlite". Got: ${rawDialect}`);
    process.exit(1);
  }
  const dialect = rawDialect as SqlDialect;

  const dbClient = await createDbClient(dbUrl, dialect);
  const store = new SqlAdapter(dbClient, { dialect });
  const lock = new InMemoryLock();
  const eventBus = new SagaEventBusImpl();
  const engine = new SagaEngine(store, lock, eventBus);

  switch (command) {
    case 'list':
      await cmdList(engine, flags);
      break;

    case 'inspect':
      if (sagaId === undefined) {
        console.error('Error: saga-cli inspect <sagaId>');
        process.exit(1);
      }
      await cmdInspect(engine, sagaId);
      break;

    case 'pause':
      if (sagaId === undefined) {
        console.error('Error: saga-cli pause <sagaId>');
        process.exit(1);
      }
      await cmdPause(engine, sagaId);
      break;

    case 'resume':
      if (sagaId === undefined) {
        console.error('Error: saga-cli resume <sagaId>');
        process.exit(1);
      }
      await cmdResume(engine, sagaId);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
