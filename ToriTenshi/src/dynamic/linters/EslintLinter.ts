import { Linter, LintContext } from '../Linter';
import { ProcessRunner } from '../ProcessRunner';
import { Finding, Severity } from '../../core/Types';

interface EslintMessage { line: number; column: number; ruleId: string | null; severity: number; message: string; }
interface EslintFile { filePath: string; messages: EslintMessage[]; }

/** JavaScript/TypeScript linter (ESLint), JSON output. */
export class EslintLinter implements Linter {
  readonly id = 'eslint';
  readonly languageIds = ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'];
  readonly command = 'eslint';

  async run(ctx: LintContext, runner: ProcessRunner): Promise<Finding[]> {
    const res = await runner.run(this.command, ['-f', 'json', ctx.absolutePath], { cwd: ctx.cwd, timeoutMs: ctx.timeoutMs });
    if (res.spawnError) {
      return [];
    }
    try {
      const files = JSON.parse(res.stdout || '[]') as EslintFile[];
      const findings: Finding[] = [];
      for (const f of files) {
        for (const m of f.messages) {
          const line = Math.max(0, (m.line ?? 1) - 1);
          const col = Math.max(0, (m.column ?? 1) - 1);
          findings.push({
            pluginId: this.id,
            ruleId: m.ruleId ?? this.id,
            message: m.message,
            severity: m.severity === 2 ? Severity.High : Severity.Medium,
            range: { file: ctx.relativePath, startLine: line, startChar: col, endLine: line, endChar: col + 120 },
          });
        }
      }
      return findings;
    } catch {
      return [];
    }
  }
}
