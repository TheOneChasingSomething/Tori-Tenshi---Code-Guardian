import { Finding } from '../core/Types';
import { Logger } from '../core/Logger';
import { Configuration } from '../core/Configuration';
import { ProcessRunner } from './ProcessRunner';
import { Linter, LintContext } from './Linter';
import { QemuInspector } from './QemuInspector';
import { HadolintLinter } from './linters/HadolintLinter';
import { EslintLinter } from './linters/EslintLinter';
import { AnsibleLintLinter } from './linters/AnsibleLintLinter';
import { RuffLinter } from './linters/RuffLinter';
import { CppcheckLinter } from './linters/CppcheckLinter';
import { ShellcheckLinter } from './linters/ShellcheckLinter';

/**
 * Dynamic-analysis orchestrator. Runs external linters and the QEMU inspector
 * as child processes to enrich the static findings.
 *
 * Everything here is opt-in (`audit.dynamic.enabled`) and best-effort: a tool
 * that is not installed is skipped silently, availability is probed once and
 * cached, and each run is bounded by a timeout. No shell is ever used.
 */
export class DynamicService {
  private readonly runner: ProcessRunner;
  private readonly linters: Linter[];
  private readonly qemu = new QemuInspector();
  private readonly availability = new Map<string, boolean>();

  constructor(private readonly config: Configuration, private readonly logger: Logger) {
    this.runner = new ProcessRunner(logger);
    this.linters = [
      new HadolintLinter(),
      new EslintLinter(),
      new AnsibleLintLinter(),
      new RuffLinter(),
      new CppcheckLinter(),
      new ShellcheckLinter(),
    ];
  }

  get enabled(): boolean {
    return this.config.dynamicEnabled;
  }

  private async isAvailable(command: string, versionArg?: string): Promise<boolean> {
    if (this.availability.has(command)) {
      return this.availability.get(command)!;
    }
    const ok = await this.runner.isAvailable(command, versionArg);
    this.availability.set(command, ok);
    return ok;
  }

  /** Reports which tools are installed (for the "check tools" command). */
  async detectTools(): Promise<{ id: string; command: string; available: boolean }[]> {
    const tools: { id: string; command: string; versionArg?: string }[] = [
      ...this.linters.map((l) => ({ id: l.id, command: l.command, versionArg: l.versionArg })),
      { id: 'qemu', command: this.qemu.command },
    ];
    const out: { id: string; command: string; available: boolean }[] = [];
    for (const t of tools) {
      out.push({ id: t.id, command: t.command, available: await this.isAvailable(t.command, t.versionArg) });
    }
    return out;
  }

  /**
   * Runs every available linter matching the document's language and merges
   * their findings. Returns an empty array when dynamic analysis is disabled.
   */
  async runLinters(ctx: LintContext, languageId: string): Promise<Finding[]> {
    if (!this.enabled) {
      return [];
    }
    const matching = this.linters.filter((l) => l.languageIds.includes(languageId));
    const results = await Promise.all(
      matching.map(async (l) => {
        if (!(await this.isAvailable(l.command, l.versionArg))) {
          return [];
        }
        try {
          return await l.run(ctx, this.runner);
        } catch (e) {
          this.logger.warn(`Linter ${l.id} failed: ${e instanceof Error ? e.message : String(e)}`);
          return [];
        }
      })
    );
    return results.flat();
  }

  /** Inspects a disk image (QEMU). Independent of the linter pipeline. */
  async inspectImage(absolutePath: string, relativePath: string): Promise<Finding[]> {
    if (!(await this.isAvailable(this.qemu.command))) {
      this.logger.warn('qemu-img not available.');
      return [];
    }
    return this.qemu.inspect(absolutePath, relativePath, this.runner, this.config.dynamicTimeoutMs);
  }

  /** Convenience factory for a LintContext with the configured timeout. */
  context(absolutePath: string, relativePath: string, text: string, cwd?: string): LintContext {
    return { absolutePath, relativePath, text, cwd, timeoutMs: this.config.dynamicTimeoutMs };
  }
}
