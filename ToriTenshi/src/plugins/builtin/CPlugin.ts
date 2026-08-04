import { RuleBasedPlugin, RegexRule } from '../../analysis/RuleBasedPlugin';
import { UNSAFE_C_FUNCTIONS } from './cRules';

/**
 * C analyzer. Uses the shared unsafe-libc-function rule set. A future clangd/
 * Tree-sitter pass will add data-flow-aware checks.
 */
export class CPlugin extends RuleBasedPlugin {
  readonly id = 'c';
  readonly displayName = 'C';
  readonly languageIds = ['c'];

  protected regexRules: RegexRule[] = [...UNSAFE_C_FUNCTIONS];
}
