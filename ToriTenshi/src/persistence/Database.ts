import { Logger } from '../core/Logger';
import { MIGRATIONS } from './migrations';
import { SqlDriver, RunResult } from './SqlDriver';

/**
 * Database coordinator over a pluggable {@link SqlDriver}. It runs migrations
 * and exposes a small positional-parameter query surface used by the SQL
 * repositories, so those repositories are backend-agnostic. The driver itself
 * is chosen (and, if needed, swapped out for a fallback) in `storage.ts`.
 */
export class AuditDatabase {
  constructor(private readonly driver: SqlDriver, logger: Logger) {
    this.migrate(logger);
  }

  exec(sql: string): void {
    this.driver.exec(sql);
  }

  run(sql: string, params: unknown[] = []): RunResult {
    return this.driver.prepare(sql).run(...params);
  }

  get<T>(sql: string, params: unknown[] = []): T | undefined {
    return this.driver.prepare(sql).get(...params) as T | undefined;
  }

  all<T>(sql: string, params: unknown[] = []): T[] {
    return this.driver.prepare(sql).all(...params) as T[];
  }

  transaction(fn: () => void): void {
    this.driver.transaction(fn)();
  }

  persist(): Promise<void> {
    return this.driver.persist();
  }

  close(): void {
    this.driver.close();
  }

  /** Applies, in order, the migrations not yet executed. */
  private migrate(logger: Logger): void {
    this.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
    const applied = new Set(this.all<{ version: number }>('SELECT version FROM schema_migrations').map((r) => r.version));

    this.transaction(() => {
      for (const migration of MIGRATIONS) {
        if (applied.has(migration.version)) {
          continue;
        }
        this.exec(migration.up);
        this.run('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [migration.version, new Date().toISOString()]);
        logger.info(`Migration ${migration.version} applied: ${migration.name}`);
      }
    });
  }
}
