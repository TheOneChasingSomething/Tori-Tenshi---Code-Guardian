import { Linter, LintContext, parseGrepFormat } from '../Linter';
import { ProcessRunner } from '../ProcessRunner';
import { Finding, Severity } from '../../core/Types';

interface HadolintItem { line: number; column: number; level: string; code: string; message: string; }

/** Dockerfile linter (hadolint). Reads the Dockerfile from stdin, JSON output. */
export class HadolintLinter implements Linter {
  readonly id = 'hadolint';
  readonly languageIds = ['dockerfile'];
  readonly command = 'hadolint';

  async run(ctx: LintContext, runner: ProcessRunner): Promise<Finding[]> {
    const res = await runner.run(this.command, ['-f', 'json', '-'], { cwd: ctx.cwd, timeoutMs: ctx.timeoutMs, stdin: ctx.text });
    if (res.spawnError) {
      return [];
    }
    try {
      const items = JSON.parse(res.stdout || '[]') as HadolintItem[];
      return items.map((it) => this.toFinding(it, ctx.relativePath));
    } catch {
      // Fall back to a lenient line parse if JSON is unavailable.
      return parseGrepFormat(res, this.id, ctx.relativePath, Severity.Medium);
    }
  }

  private toFinding(it: HadolintItem, file: string): Finding {
    const sev = it.level === 'error' ? Severity.High : it.level === 'warning' ? Severity.Medium : it.level === 'info' ? Severity.Low : Severity.Info;
    const line = Math.max(0, (it.line ?? 1) - 1);
    const col = Math.max(0, (it.column ?? 1) - 1);
    return { pluginId: this.id, ruleId: it.code || this.id, message: it.message, severity: sev, range: { file, startLine: line, startChar: col, endLine: line, endChar: col + 120 } };
  }
}
