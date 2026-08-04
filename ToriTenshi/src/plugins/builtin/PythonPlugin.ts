import { RuleBasedPlugin, RegexRule, QueryRule } from '../../analysis/RuleBasedPlugin';
import { Severity } from '../../core/Types';

/**
 * Python analyzer. Regex baseline covers the common injection/deserialization
 * pitfalls; a Tree-sitter query rule (PY-Q1) demonstrates the structural path
 * for detecting eval/exec calls precisely when the grammar is present.
 *
 * Rules: PY001 eval/exec · PY002 shell=True · PY003 yaml.load · PY004 pickle.load · PY005 hardcoded secret.
 */
export class PythonPlugin extends RuleBasedPlugin {
  readonly id = 'python';
  readonly displayName = 'Python';
  readonly languageIds = ['python'];

  protected regexRules: RegexRule[] = [
    { id: 'PY001', severity: Severity.High, pattern: /\b(eval|exec)\s*\(/, message: 'Dynamic code execution (CWE-95). Avoid eval/exec on untrusted input.' },
    { id: 'PY002', severity: Severity.High, pattern: /shell\s*=\s*True/, message: 'subprocess with shell=True (CWE-78). Pass an argument list instead.' },
    { id: 'PY003', severity: Severity.Medium, pattern: /yaml\.load\s*\((?![^)]*Loader\s*=\s*yaml\.SafeLoader)/, message: 'yaml.load without SafeLoader (CWE-502). Use yaml.safe_load.' },
    { id: 'PY004', severity: Severity.Medium, pattern: /pickle\.load\s*\(/, message: 'pickle.load deserializes arbitrary objects (CWE-502).' },
    { id: 'PY005', severity: Severity.Medium, pattern: /\b(password|api_key|secret|token)\s*=\s*["'][^"']+["']/i, message: 'Possible hardcoded secret (CWE-798).' },
  ];

  protected queryRules: QueryRule[] = [
    {
      id: 'PY-Q1',
      severity: Severity.High,
      captureName: 'dangerous',
      message: 'Call to eval/exec detected structurally.',
      query: '(call function: (identifier) @dangerous (#match? @dangerous "^(eval|exec)$"))',
    },
  ];
}
