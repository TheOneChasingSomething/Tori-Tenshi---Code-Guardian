import { Linter, LintContext, parseGrepFormat } from '../Linter';
import { ProcessRunner } from '../ProcessRunner';
import { Severity, Finding } from '../../core/Types';

/** Ansible linter (ansible-lint) in pep8 output, parsed generically. */
export class AnsibleLintLinter implements Linter {
  readonly id = 'ansible-lint';
  readonly languageIds = ['yaml', 'ansible'];
  readonly command = 'ansible-lint';

  async run(ctx: LintContext, runner: ProcessRunner): Promise<Finding[]> {
    const res = await runner.run(this.command, ['-f', 'pep8', ctx.absolutePath], { cwd: ctx.cwd, timeoutMs: ctx.timeoutMs });
    if (res.spawnError) {
      return [];
    }
    return parseGrepFormat(res, this.id, ctx.relativePath, Severity.Medium);
  }
}
