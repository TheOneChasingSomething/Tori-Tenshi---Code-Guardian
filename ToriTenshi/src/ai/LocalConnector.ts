import { AiConnector, AiRequest, AiResponse } from './AiConnector';
import { Severity } from '../core/Types';

/**
 * Local-mode connector. Performs NO external inference: no network call, no
 * model — nothing leaves the machine. It composes a deterministic, static
 * synthesis from metrics and the findings already gathered, so the "local by
 * default" mode is still useful without any LLM.
 */
export class LocalConnector implements AiConnector {
  readonly id = 'local';
  readonly isLocal = true;

  async run(request: AiRequest): Promise<AiResponse> {
    const lines = request.code.split(/\r?\n/);
    const bySeverity = new Map<string, number>();
    for (const f of request.findings ?? []) {
      bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
    }
    const order = [Severity.Critical, Severity.High, Severity.Medium, Severity.Low, Severity.Info];
    const severityLine = order
      .filter((s) => bySeverity.get(s))
      .map((s) => `${s}: ${bySeverity.get(s)}`)
      .join(', ');

    const todos = lines
      .map((l, i) => ({ l, i }))
      .filter((x) => /\b(TODO|FIXME|XXX|HACK)\b/.test(x.l))
      .map((x) => `- L${x.i + 1}: ${x.l.trim()}`);

    const out: string[] = [
      `# Local synthesis — ${request.relativePath}`,
      '',
      '> Local mode: no LLM was used and no code left the machine.',
      '',
      `- Language: ${request.languageId}`,
      `- Lines: ${lines.length}`,
      `- Findings: ${request.findings?.length ?? 0}${severityLine ? ` (${severityLine})` : ''}`,
      '',
    ];
    if ((request.findings?.length ?? 0) > 0) {
      out.push('## Reported findings', '');
      for (const f of request.findings!) {
        out.push(`- **[${f.severity}] ${f.ruleId}** (L${f.range.startLine + 1}): ${f.message}`);
      }
      out.push('');
    }
    if (todos.length > 0) {
      out.push('## Markers', '', ...todos, '');
    }
    out.push('_Switch to `llm-local` or the remote agent for a natural-language review._');

    return { text: out.join('\n'), connectorId: this.id, local: true };
  }
}
