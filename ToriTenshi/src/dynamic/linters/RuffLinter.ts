import { Linter, LintContext, parseGrepFormat } from '../Linter';
import { ProcessRunner } from '../ProcessRunner';
import { Severity, Finding } from '../../core/Types';

/** Python linter (Ruff), concise output, parsed generically. */
export class RuffLinter implements Linter {
  readonly id = 'ruff';
  readonly languageIds = ['python'];
  readonly command = 'ruff';

  async run(ctx: LintContext, runner: ProcessRunner): Promise<Finding[]> {
    const res = await runner.run(this.command, ['check', '--output-format', 'concise', ctx.absolutePath], { cwd: ctx.cwd, timeoutMs: ctx.timeoutMs });
    if (res.spawnError) {
      return [];
    }
    return parseGrepFormat(res, this.id, ctx.relativePath, Severity.Medium);
  }
}
