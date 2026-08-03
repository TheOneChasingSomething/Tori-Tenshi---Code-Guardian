import { AuditPlugin, AnalyzableDocument, PluginContext } from '../AuditPlugin';
import { AnalysisResult, emptyAnalysis } from '../../core/Types';

/**
 * Plugin Packer (HCL). Ébauche : enregistre le contrat et le langage.
 * L'analyse HCL réelle (blocs `source`, `build`, provisioners) sera
 * implémentée en Phase 3 via une grammaire Tree-sitter HCL.
 */
export class PackerPlugin implements AuditPlugin {
  readonly id = 'packer';
  readonly displayName = 'Packer (HCL)';
  readonly languageIds = ['hcl', 'packer'];

  analyze(_doc: AnalyzableDocument, ctx: PluginContext): AnalysisResult {
    ctx.logger.info('PackerPlugin : analyse HCL non encore implémentée (Phase 3).');
    return emptyAnalysis();
  }
}
