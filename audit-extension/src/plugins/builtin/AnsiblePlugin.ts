import { AuditPlugin, AnalyzableDocument, PluginContext } from '../AuditPlugin';
import { AnalysisResult, Finding, Severity, emptyAnalysis } from '../../core/Types';

/**
 * Ansible analyzer (YAML playbooks/roles). Seed implementation: detects the use
 * of the `shell`/`command` modules and unqualified `become: true`. Phase 3 will
 * delegate to ansible-lint and a full YAML parser; this only illustrates the
 * contract.
 *
 * Rules covered:
 *  - ANS001: use of `shell:` or `command:` (prefer a dedicated module).
 *  - ANS002: privilege escalation `become: true`.
 */
export class AnsiblePlugin implements AuditPlugin {
  readonly id = 'ansible';
  readonly displayName = 'Ansible';
  readonly languageIds = ['yaml', 'ansible'];

  analyze(doc: AnalyzableDocument, _ctx: PluginContext): AnalysisResult {
    const result = emptyAnalysis();
    // Coarse filter: only analyze files that look like Ansible.
    if (!/tasks:|hosts:|become:|ansible/i.test(doc.text)) {
      return result;
    }
    const lines = doc.text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/^\s*(shell|command)\s*:/.test(line)) {
        result.findings.push(this.finding('ANS001', 'shell/command module: prefer an idempotent Ansible module.', Severity.Low, doc.relativePath, index));
      }
      if (/^\s*become\s*:\s*(true|yes)\s*$/i.test(line)) {
        result.findings.push(this.finding('ANS002', 'Privilege escalation (become): verify it is required.', Severity.Medium, doc.relativePath, index));
      }
    });
    return result;
  }

  private finding(ruleId: string, message: string, severity: Severity, file: string, line: number): Finding {
    return { pluginId: this.id, ruleId, message, severity, range: { file, startLine: line, startChar: 0, endLine: line, endChar: 200 } };
  }
}
