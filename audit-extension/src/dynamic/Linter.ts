import { Finding } from '../core/Types';
import { ProcessRunner, ProcessResult } from './ProcessRunner';

/** Context passed to a linter for a single document. */
export interface LintContext {
  /** Absolute path of the file on disk. */
  absolutePath: string;
  /** Path relative to the workspace root (used in Finding ranges). */
  relativePath: string;
  /** Working directory for the process (usually the workspace folder). */
  cwd?: string;
  /** Document text (for linters that read from stdin). */
  text: string;
  timeoutMs: number;
}

/**
 * An external linter/analyzer invoked as a child process. Implementations own
 * the command, its arguments, and the parsing of its output into Findings, but
 * never execute a shell (see ProcessRunner).
 */
export interface Linter {
  /** Stable id used as the finding's pluginId (e.g. "hadolint"). */
  readonly id: string;
  /** VS Code language ids this linter applies to. */
  readonly languageIds: string[];
  /** The binary name, probed for availability. */
  readonly command: string;
  /** Version flag used for availability detection. */
  readonly versionArg?: string;

  /** Runs the linter and maps its output into Findings. */
  run(ctx: LintContext, runner: ProcessRunner): Promise<Finding[]>;
}

/** Helper: parse a common `file:line[:col]: message` grep-style format. */
export function parseGrepFormat(
  res: ProcessResult,
  linterId: string,
  relativePath: string,
  severity: Finding['severity']
): Finding[] {
  const out = (res.stdout || '') + '\n' + (res.stderr || '');
  const findings: Finding[] = [];
  const re = /^(?:.*?):(\d+)(?::(\d+))?:\s*(.+)$/;
  for (const line of out.split(/\r?\n/)) {
    const m = line.match(re);
    if (!m) {
      continue;
    }
    const ln = Math.max(0, parseInt(m[1], 10) - 1);
    const col = m[2] ? Math.max(0, parseInt(m[2], 10) - 1) : 0;
    findings.push({
      pluginId: linterId,
      ruleId: linterId,
      message: m[3].trim(),
      severity,
      range: { file: relativePath, startLine: ln, startChar: col, endLine: ln, endChar: col + 120 },
    });
  }
  return findings;
}
