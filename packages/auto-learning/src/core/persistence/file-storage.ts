import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { ok, fail } from '@backendkit-labs/result';
import type { Result } from '@backendkit-labs/result';
import { InMemoryStorage } from './in-memory-storage.js';
import { TunableConfig } from '../types.js';
import { LearningError, storageError } from '../errors.js';

/**
 * Extends InMemoryStorage with config persistence to a JSON file.
 * Patterns, anomalies, and cycle events remain in-memory and are
 * re-learned after restart. Only the tuned TunableConfig survives.
 */
export class FileStorageAdapter extends InMemoryStorage {
  constructor(private readonly filePath: string = './auto-learning-config.json') {
    super();
  }

  override saveConfig(config: TunableConfig): Result<void, LearningError> {
    try {
      mkdirSync(dirname(this.filePath), { recursive: true });
      writeFileSync(this.filePath, JSON.stringify(config, null, 2), 'utf8');
      return super.saveConfig(config);
    } catch (e) {
      return fail(storageError('Failed to persist config to file', e));
    }
  }

  override loadConfig(): Result<TunableConfig | null, LearningError> {
    try {
      const raw = readFileSync(this.filePath, 'utf8');
      const config = JSON.parse(raw) as TunableConfig;
      super.saveConfig(config);
      return ok(config);
    } catch (e: unknown) {
      if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'ENOENT') {
        return ok(null);
      }
      return fail(storageError('Failed to load config from file', e));
    }
  }
}
