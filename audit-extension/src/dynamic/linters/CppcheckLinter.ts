import { Linter, LintContext, parseGrepFormat } from '../Linter';
import { ProcessRunner } from '../ProcessRunner';
import { Severity, Finding } from '../../core/Types';

/** C/C++ linter (cppcheck) with a grep-style template on stderr. */
export class CppcheckLinter implements Linter {
  readonly id = 'cppcheck';
  readonly languageIds = ['c', 'cpp'];
  readonly command = 'cppcheck';

  async run(ctx: LintContext, runner: ProcessRunner): Promise<Finding[]> {
    const res = await runner.run(
      this.command,
      ['--enable=warning,style,performance', '--quiet', '--template={file}:{line}:{column}: {severity}: {message} [{id}]', ctx.absolutePath],
      { cwd: ctx.cwd, timeoutMs: ctx.timeoutMs }
    );
    if (res.spawnError) {
      return [];
    }
    return parseGrepFormat(res, this.id, ctx.relativePath, Severity.Medium);
  }
}
