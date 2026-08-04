import { RuleBasedPlugin, RegexRule } from '../../analysis/RuleBasedPlugin';
import { Severity } from '../../core/Types';

/**
 * HTML analyzer. Focuses on client-side security smells.
 *
 * Rules: HTML001 inline event handler · HTML002 http:// resource (mixed content)
 * · HTML003 target=_blank without rel=noopener · HTML004 iframe present.
 */
export class HtmlPlugin extends RuleBasedPlugin {
  readonly id = 'html';
  readonly displayName = 'HTML';
  readonly languageIds = ['html'];

  protected regexRules: RegexRule[] = [
    { id: 'HTML001', severity: Severity.Low, pattern: /\son[a-z]+\s*=\s*["']/i, message: 'Inline event handler: prefer addEventListener and a CSP.' },
    { id: 'HTML002', severity: Severity.Medium, pattern: /(src|href)\s*=\s*["']http:\/\//i, message: 'Resource loaded over http:// (mixed content). Use https.' },
    { id: 'HTML003', severity: Severity.Low, pattern: /target\s*=\s*["']_blank["'](?![^>]*rel\s*=\s*["'][^"']*noopener)/i, message: 'target="_blank" without rel="noopener" (reverse tabnabbing).' },
    { id: 'HTML004', severity: Severity.Info, pattern: /<iframe\b/i, message: 'iframe present: review sandbox and allow attributes.' },
  ];
}
