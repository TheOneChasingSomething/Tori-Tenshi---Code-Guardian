import { AuditPlugin, AnalyzableDocument, PluginContext } from '../AuditPlugin';
import { AnalysisResult, Finding, Severity, emptyAnalysis } from '../../core/Types';

/**
 * Analyseur Ansible (playbooks/rôles YAML). Implémentation d'amorce :
 * détecte l'usage de modules « shell/command » et de « become: true »
 * sans justification. La Phase 3 déléguera à ansible-lint et à un parseur
 * YAML complet ; on illustre ici uniquement le contrat.
 *
 * Règles couvertes :
 *  - ANS001 : usage de `shell:` ou `command:` (préférer un module dédié).
 *  - ANS002 : élévation de privilèges `become: true`.
 */
export class AnsiblePlugin implements AuditPlugin {
  readonly id = 'ansible';
  readonly displayName = 'Ansible';
  readonly languageIds = ['yaml', 'ansible'];

  analyze(doc: AnalyzableDocument, _ctx: PluginContext): AnalysisResult {
    const result = emptyAnalysis();
    // Filtre grossier : n'analyse que les fichiers ressemblant à de l'Ansible.
    if (!/tasks:|hosts:|become:|ansible/i.test(doc.text)) {
      return result;
    }
    const lines = doc.text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (/^\s*(shell|command)\s*:/.test(line)) {
        result.findings.push(this.finding('ANS001', 'Module shell/command : privilégiez un module Ansible idempotent.', Severity.Low, doc.relativePath, index));
      }
      if (/^\s*become\s*:\s*(true|yes)\s*$/i.test(line)) {
        result.findings.push(this.finding('ANS002', 'Élévation de privilèges (become) : vérifiez la nécessité.', Severity.Medium, doc.relativePath, index));
      }
    });
    return result;
  }

  private finding(ruleId: string, message: string, severity: Severity, file: string, line: number): Finding {
    return { pluginId: this.id, ruleId, message, severity, range: { file, startLine: line, startChar: 0, endLine: line, endChar: 200 } };
  }
}
