import { RuleBasedPlugin, RegexRule } from '../../analysis/RuleBasedPlugin';
import { UNSAFE_C_FUNCTIONS } from './cRules';
import { Severity } from '../../core/Types';

/**
 * C++ analyzer. Reuses the unsafe-libc rules and adds a couple of C++-specific
 * smells.
 *
 * Extra rules: CPP001 C-style cast of malloc · CPP002 using namespace std in header.
 */
export class CppPlugin extends RuleBasedPlugin {
  readonly id = 'cpp';
  readonly displayName = 'C++';
  readonly languageIds = ['cpp'];

  protected regexRules: RegexRule[] = [
    ...UNSAFE_C_FUNCTIONS,
    { id: 'CPP001', severity: Severity.Low, pattern: /\bnew\s+\w+\s*\[[^\]]*\]/, message: 'Raw array new[]: prefer std::vector or smart pointers (RAII).' },
    { id: 'CPP002', severity: Severity.Info, pattern: /using\s+namespace\s+std\s*;/, message: 'using namespace std pollutes the global scope; avoid in headers.' },
  ];
}
