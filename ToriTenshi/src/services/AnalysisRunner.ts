import * as vscode from 'vscode';
import { PluginManager } from '../plugins/PluginManager';
import { TrustNodeStore } from '../persistence/ports';
import { TrustEdgeStore } from '../persistence/ports';
import { DiagnosticsController } from '../ui/DiagnosticsController';
import { DynamicService } from '../dynamic/DynamicService';
import { EventBus } from '../core/EventBus';
import { Logger } from '../core/Logger';
import { Finding, TrustState } from '../core/Types';
import { relPath } from '../core/workspacePath';

/**
 * Central analysis pipeline: route a document through the plugins, persist the
 * discovered graph (nodes/edges), optionally enrich with dynamic (linter)
 * findings, and publish everything as diagnostics. Shared by the workspace scan
 * and by on-save analysis so both paths stay identical.
 */
export class AnalysisRunner {
  constructor(
    private readonly plugins: PluginManager,
    private readonly nodes: TrustNodeStore,
    private readonly edges: TrustEdgeStore,
    private readonly diagnostics: DiagnosticsController,
    private readonly dynamic: DynamicService,
    private readonly bus: EventBus,
    private readonly logger: Logger
  ) {}

  /** Analyzes a single document; returns the number of findings. */
  async runDocument(uri: vscode.Uri, document: vscode.TextDocument, includeDynamic = true): Promise<number> {
    const relative = relPath(uri);
    const result = await this.plugins.analyze({
      relativePath: relative,
      languageId: document.languageId,
      text: document.getText(),
    });

    const keyToId = new Map<string, number>();
    for (const n of result.nodes) {
      const saved = this.nodes.upsert({ key: n.key, label: n.label, kind: n.kind, state: TrustState.Unreviewed, file: n.range?.file });
      keyToId.set(n.key, saved.id);
    }
    for (const e of result.edges) {
      const from = keyToId.get(e.fromKey);
      const to = keyToId.get(e.toKey);
      if (from && to) {
        this.edges.upsert(from, to, e.label);
      }
    }

    // Dynamic enrichment (external linters), merged with the static findings.
    const findings: Finding[] = [...result.findings];
    if (includeDynamic && this.dynamic.enabled) {
      const cwd = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;
      const ctx = this.dynamic.context(uri.fsPath, relative, document.getText(), cwd);
      findings.push(...(await this.dynamic.runLinters(ctx, document.languageId)));
    }

    this.diagnostics.publish(uri, findings);
    this.bus.emit('analysis:completed', { file: relative, findingCount: findings.length });
    return findings.length;
  }

  /** Analyzes the whole workspace; returns aggregate counts. */
  async runWorkspace(): Promise<{ files: number; findings: number }> {
    const uris = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 2000);
    let findings = 0;
    for (const uri of uris) {
      let document: vscode.TextDocument;
      try {
        document = await vscode.workspace.openTextDocument(uri);
      } catch {
        continue;
      }
      findings += await this.runDocument(uri, document);
    }
    this.bus.emit('views:refresh', undefined);
    this.logger.info(`Workspace analysis complete: ${findings} findings across ${uris.length} files.`);
    return { files: uris.length, findings };
  }
}
