import { RegexRule } from '../../analysis/RuleBasedPlugin';
import { Severity } from '../../core/Types';

/**
 * Rules for classic memory-unsafe libc functions, shared by the C and C++
 * analyzers. These are the canonical CWE-120/CWE-676 offenders.
 */
export const UNSAFE_C_FUNCTIONS: RegexRule[] = [
  { id: 'C001', severity: Severity.Critical, pattern: /\bgets\s*\(/, message: 'gets() has no bounds checking (CWE-242). Use fgets().' },
  { id: 'C002', severity: Severity.High, pattern: /\b(strcpy|strcat)\s*\(/, message: 'Unbounded string copy (CWE-120). Use strncpy/strncat or safer APIs.' },
  { id: 'C003', severity: Severity.High, pattern: /\bsprintf\s*\(/, message: 'sprintf() may overflow the buffer (CWE-120). Use snprintf().' },
  { id: 'C004', severity: Severity.High, pattern: /\bsystem\s*\(/, message: 'system() invokes a shell (CWE-78). Prefer exec* with argument vectors.' },
  { id: 'C005', severity: Severity.Medium, pattern: /\b(scanf|sscanf)\s*\([^)]*%s/, message: 'Unbounded %s in *scanf (CWE-120). Specify a field width.' },
];
