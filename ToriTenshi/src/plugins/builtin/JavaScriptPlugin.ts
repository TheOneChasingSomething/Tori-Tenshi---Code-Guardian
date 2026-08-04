import { RuleBasedPlugin, RegexRule } from '../../analysis/RuleBasedPlugin';
import { Severity } from '../../core/Types';

/**
 * JavaScript/TypeScript analyzer. Regex baseline for the common web/Node
 * pitfalls. ESLint integration (Phase 5) will supersede several of these.
 *
 * Rules: JS001 eval · JS002 child_process exec · JS003 innerHTML · JS004 document.write · JS005 hardcoded secret.
 */
export class JavaScriptPlugin extends RuleBasedPlugin {
  readonly id = 'javascript';
  readonly displayName = 'JavaScript/TypeScript';
  readonly languageIds = ['javascript', 'javascriptreact', 'typescript', 'typescriptreact'];

  protected regexRules: RegexRule[] = [
    { id: 'JS001', severity: Severity.High, pattern: /\beval\s*\(/, message: 'eval() executes arbitrary code (CWE-95).' },
    { id: 'JS002', severity: Severity.High, pattern: /child_process[\s\S]*\bexec\s*\(/, message: 'child_process.exec spawns a shell (CWE-78). Prefer execFile.' },
    { id: 'JS003', severity: Severity.Medium, pattern: /\.innerHTML\s*=/, message: 'Assignment to innerHTML (CWE-79/XSS). Sanitize or use textContent.' },
    { id: 'JS004', severity: Severity.Low, pattern: /document\.write\s*\(/, message: 'document.write can enable XSS and blocks parsing.' },
    { id: 'JS005', severity: Severity.Medium, pattern: /\b(password|apiKey|secret|token)\s*[:=]\s*["'][^"']+["']/i, message: 'Possible hardcoded secret (CWE-798).' },
  ];
}
