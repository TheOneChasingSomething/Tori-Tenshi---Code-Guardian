import { spawn } from 'child_process';
import { Logger } from '../core/Logger';

/** Outcome of an external process invocation. */
export interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  /** Set when the binary could not be spawned (e.g. ENOENT: not installed). */
  spawnError?: string;
}

export interface RunOptions {
  cwd?: string;
  timeoutMs?: number;
  /** Text piped to the process stdin (e.g. hadolint reads a Dockerfile there). */
  stdin?: string;
}

/**
 * Thin, safe wrapper around child_process.spawn.
 *
 * Security invariants:
 *  - arguments are always passed as an array; `shell` is never enabled, so user
 *    content (paths, code) can never be interpreted by a shell;
 *  - every run is bounded by a timeout and the child is killed on expiry;
 *  - a missing binary resolves to `spawnError` instead of throwing, so callers
 *    can detect tool availability without exceptions.
 */
export class ProcessRunner {
  constructor(private readonly logger: Logger) {}

  run(command: string, args: string[], opts: RunOptions = {}): Promise<ProcessResult> {
    const timeoutMs = opts.timeoutMs ?? 20000;
    return new Promise<ProcessResult>((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let settled = false;

      const child = spawn(command, args, { cwd: opts.cwd, shell: false });

      const finish = (result: ProcessResult) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(result);
      };

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      child.on('error', (err: NodeJS.ErrnoException) => {
        finish({ code: null, stdout, stderr, timedOut, spawnError: err.code ?? err.message });
      });
      child.stdout?.on('data', (d: Buffer) => {
        stdout += d.toString();
      });
      child.stderr?.on('data', (d: Buffer) => {
        stderr += d.toString();
      });
      child.on('close', (code: number | null) => {
        finish({ code, stdout, stderr, timedOut });
      });

      if (opts.stdin !== undefined) {
        child.stdin?.end(opts.stdin);
      }
    });
  }

  /**
   * Detects whether a command is runnable by invoking it with a version flag.
   * Any spawn that is not ENOENT counts as available (a non-zero exit is fine).
   */
  async isAvailable(command: string, versionArg = '--version'): Promise<boolean> {
    const res = await this.run(command, [versionArg], { timeoutMs: 5000 });
    if (res.spawnError === 'ENOENT') {
      return false;
    }
    if (res.spawnError) {
      this.logger.warn(`Tool ${command} probe error: ${res.spawnError}`);
      return false;
    }
    return true;
  }
}
