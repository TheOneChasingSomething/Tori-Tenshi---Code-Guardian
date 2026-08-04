import { Linter, LintContext, parseGrepFormat } from '../Linter';
import { ProcessRunner } from '../ProcessRunner';
import { Severity, Finding } from '../../core/Types';

/** Shell linter (shellcheck) in gcc format, parsed generically. */
export class ShellcheckLinter implements Linter {
  readonly id = 'shellcheck';
  readonly languageIds = ['shellscript'];
  readonly command = 'shellcheck';

  async run(ctx: LintContext, runner: ProcessRunner): Promise<Finding[]> {
    const res = await runner.run(this.command, ['-f', 'gcc', ctx.absolutePath], { cwd: ctx.cwd, timeoutMs: ctx.timeoutMs });
    if (res.spawnError) {
      return [];
    }
    return parseGrepFormat(res, this.id, ctx.relativePath, Severity.Medium);
  }
}
