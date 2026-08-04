import { AnalyzableDocument } from '../AuditPlugin';
import { RuleBasedPlugin, RegexRule } from '../../analysis/RuleBasedPlugin';
import { Severity } from '../../core/Types';

/**
 * Ansible analyzer (YAML playbooks/roles). Guarded so it only inspects files
 * that look like Ansible. Phase 3 keeps regex rules; a full YAML/Tree-sitter
 * pass and ansible-lint integration come later.
 *
 * Rules: ANS001 shell/command · ANS002 become · ANS003 validate_certs disabled.
 */
export class AnsiblePlugin extends RuleBasedPlugin {
  readonly id = 'ansible';
  readonly displayName = 'Ansible';
  readonly languageIds = ['yaml', 'ansible'];

  protected regexRules: RegexRule[] = [
    { id: 'ANS001', severity: Severity.Low, pattern: /^\s*(shell|command)\s*:/, message: 'shell/command module: prefer an idempotent Ansible module.' },
    { id: 'ANS002', severity: Severity.Medium, pattern: /^\s*become\s*:\s*(true|yes)\s*$/i, message: 'Privilege escalation (become): verify it is required.' },
    { id: 'ANS003', severity: Severity.High, pattern: /^\s*validate_certs\s*:\s*(false|no)\s*$/i, message: 'TLS verification disabled (validate_certs: false).' },
  ];

  protected guard(doc: AnalyzableDocument): boolean {
    return /tasks:|hosts:|become:|ansible/i.test(doc.text);
  }
}
