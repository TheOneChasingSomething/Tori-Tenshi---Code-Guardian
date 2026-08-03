import { AuditPlugin, AnalyzableDocument, PluginContext } from '../AuditPlugin';
import { AnalysisResult, emptyAnalysis } from '../../core/Types';

/**
 * Packer plugin (HCL). Stub: registers the contract and the language. Real HCL
 * analysis (`source`, `build`, provisioner blocks) will be implemented in
 * Phase 3 via a Tree-sitter HCL grammar.
 */
export class PackerPlugin implements AuditPlugin {
  readonly id = 'packer';
  readonly displayName = 'Packer (HCL)';
  readonly languageIds = ['hcl', 'packer'];

  analyze(_doc: AnalyzableDocument, ctx: PluginContext): AnalysisResult {
    ctx.logger.info('PackerPlugin: HCL analysis not yet implemented (Phase 3).');
    return emptyAnalysis();
  }
}
