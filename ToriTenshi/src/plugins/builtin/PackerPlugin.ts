import { RuleBasedPlugin, RegexRule } from '../../analysis/RuleBasedPlugin';
import { Severity } from '../../core/Types';

/**
 * Packer analyzer (HCL). Regex baseline now; a Tree-sitter HCL pass (source,
 * build, provisioner blocks) can be added once the grammar is present.
 *
 * Rules: PKR001 insecure/skip TLS · PKR002 inline sudo provisioner · PKR003 hardcoded secret.
 */
export class PackerPlugin extends RuleBasedPlugin {
  readonly id = 'packer';
  readonly displayName = 'Packer (HCL)';
  readonly languageIds = ['hcl', 'packer'];

  protected regexRules: RegexRule[] = [
    { id: 'PKR001', severity: Severity.High, pattern: /^\s*(insecure|skip_certificate|skip_tls_verify)\s*=\s*true/i, message: 'TLS verification disabled in a Packer block.' },
    { id: 'PKR002', severity: Severity.Medium, pattern: /sudo\s+/i, message: 'Provisioner runs with sudo: confirm the elevation is necessary.' },
    { id: 'PKR003', severity: Severity.Medium, pattern: /^\s*(password|secret|token|access_key)\s*=\s*"[^"]+"/i, message: 'Hardcoded secret in HCL: use a variable or a secret store.' },
  ];
}
