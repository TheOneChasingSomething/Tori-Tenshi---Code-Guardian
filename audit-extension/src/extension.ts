import * as vscode from 'vscode';
import { Logger } from './core/Logger';
import { EventBus } from './core/EventBus';
import { Configuration } from './core/Configuration';
import { relPath } from './core/workspacePath';
import { AuditDatabase } from './persistence/Database';
import { AnnotationRepository } from './persistence/repositories/AnnotationRepository';
import { TrustNodeRepository } from './persistence/repositories/TrustNodeRepository';
import { TrustEdgeRepository } from './persistence/repositories/TrustEdgeRepository';
import { KnowledgeRepository } from './persistence/repositories/KnowledgeRepository';
import { BookmarkRepository } from './persistence/repositories/BookmarkRepository';
import { SyntaxEngine } from './analysis/SyntaxEngine';
import { WebTreeSitterEngine } from './analysis/WebTreeSitterEngine';
import { PluginManager } from './plugins/PluginManager';
import { AuditPlugin } from './plugins/AuditPlugin';
import { DockerPlugin } from './plugins/builtin/DockerPlugin';
import { AnsiblePlugin } from './plugins/builtin/AnsiblePlugin';
import { PackerPlugin } from './plugins/builtin/PackerPlugin';
import { PythonPlugin } from './plugins/builtin/PythonPlugin';
import { JavaScriptPlugin } from './plugins/builtin/JavaScriptPlugin';
import { CPlugin } from './plugins/builtin/CPlugin';
import { CppPlugin } from './plugins/builtin/CppPlugin';
import { HtmlPlugin } from './plugins/builtin/HtmlPlugin';
import { ObsidianService } from './obsidian/ObsidianService';
import { GraphService } from './graph/GraphService';
import { GraphPanel } from './ui/GraphPanel';
import { ReportService } from './report/ReportService';
import { DashboardPanel } from './ui/DashboardPanel';
import { AiService } from './ai/AiService';
import { AiTask } from './ai/AiConnector';
import { REMOTE_TOKEN_KEY } from './ai/RemoteAgentConnector';
import { AnnotationService } from './services/AnnotationService';
import { AnalysisRunner } from './services/AnalysisRunner';
import { DynamicService } from './dynamic/DynamicService';
import { DiagnosticsController } from './ui/DiagnosticsController';
import { AuditTreeProvider } from './ui/AuditTreeProvider';
import { TrustGraphTreeProvider } from './ui/TrustGraphTreeProvider';
import { KnowledgeTreeProvider } from './ui/KnowledgeTreeProvider';
import { BookmarkTreeProvider } from './ui/BookmarkTreeProvider';
import { registerCommands } from './commands/registerCommands';

/**
 * Entry point. Assembles the dependency graph:
 * database -> repositories -> syntax engine -> plugins -> services
 * (Obsidian, annotations, analysis) -> views -> commands.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = new Logger();
  context.subscriptions.push({ dispose: () => logger.dispose() });
  logger.info('Activating Audit Extension…');

  const config = new Configuration();
  const bus = new EventBus();

  // --- Persistence ---------------------------------------------------------
  const storageDir = context.globalStorageUri.fsPath;
  const db = AuditDatabase.open(storageDir, logger);
  context.subscriptions.push({ dispose: () => db.close() });

  const annotations = new AnnotationRepository(db);
  const nodes = new TrustNodeRepository(db);
  const edges = new TrustEdgeRepository(db);
  const knowledge = new KnowledgeRepository(db);
  const bookmarks = new BookmarkRepository(db);

  // --- Analysis backend ----------------------------------------------------
  const grammarsDir = config.grammarsPath || WebTreeSitterEngine.defaultGrammarsDir(context.extensionUri);
  const syntax: SyntaxEngine = new WebTreeSitterEngine(grammarsDir, logger);

  const plugins = new PluginManager(logger, config, syntax);
  const builtins: AuditPlugin[] = [
    new DockerPlugin(),
    new AnsiblePlugin(),
    new PackerPlugin(),
    new PythonPlugin(),
    new JavaScriptPlugin(),
    new CPlugin(),
    new CppPlugin(),
    new HtmlPlugin(),
  ];
  for (const plugin of builtins) {
    await plugins.register(plugin);
  }
  context.subscriptions.push({ dispose: () => plugins.dispose() });

  // Preload grammars in the background; analyzers use regex fallback until ready.
  void Promise.all([...new Set(builtins.flatMap((p) => p.languageIds))].map((lang) => syntax.load(lang)));

  // --- Services ------------------------------------------------------------
  const diagnostics = new DiagnosticsController();
  context.subscriptions.push({ dispose: () => diagnostics.dispose() });

  const dynamic = new DynamicService(config, logger);

  const runner = new AnalysisRunner(plugins, nodes, edges, diagnostics, dynamic, bus, logger);
  const obsidian = new ObsidianService(config, logger, knowledge);
  const graph = new GraphService(nodes, edges);
  const ai = new AiService(config, logger, context.workspaceState, context.secrets);
  const report = new ReportService(nodes, annotations, bookmarks, knowledge);

  // Runs an AI task on the active editor's selection (or the whole file),
  // grounding the prompt with the file's static findings.
  const runAiTask = async (task: AiTask): Promise<void> => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const relative = relPath(editor.document.uri);
    const sel = editor.selection;
    const code = sel.isEmpty ? editor.document.getText() : editor.document.getText(sel);
    const analysis = await plugins.analyze({ relativePath: relative, languageId: editor.document.languageId, text: editor.document.getText() });
    try {
      const resp = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `AI: ${task}…` },
        () => ai.run({ task, languageId: editor.document.languageId, relativePath: relative, code, findings: analysis.findings })
      );
      const header = `<!-- ${resp.connectorId}${resp.local ? ' (local)' : ' (external)'} · ${relative} -->\n\n`;
      const doc = await vscode.workspace.openTextDocument({ content: header + resp.text, language: 'markdown' });
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch (e) {
      vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
    }
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('audit.explainSelection', () => runAiTask('explain')),
    vscode.commands.registerCommand('audit.reviewFile', () => runAiTask('review')),
    vscode.commands.registerCommand('audit.aiStatus', () => vscode.window.showInformationMessage(ai.status())),

    // Explicit consent management for the remote agent (Windsurf).
    vscode.commands.registerCommand('audit.authorizeRemoteAgent', async () => {
      const choice = await vscode.window.showQuickPick(['Authorize for this workspace', 'Revoke'], { placeHolder: 'Remote agent (Windsurf)' });
      if (!choice) {
        return;
      }
      if (choice.startsWith('Authorize')) {
        const ok = await vscode.window.showWarningMessage(
          'You are about to allow sending source code to an external service (Windsurf) for this workspace.',
          { modal: true },
          'I understand, authorize'
        );
        await ai.setConsent(ok === 'I understand, authorize');
      } else {
        await ai.setConsent(false);
      }
    }),

    // Store the remote-agent bearer token in SecretStorage (never in settings).
    vscode.commands.registerCommand('audit.setRemoteAgentToken', async () => {
      const token = await vscode.window.showInputBox({ prompt: 'Remote agent API token', password: true });
      if (token === undefined) {
        return;
      }
      if (token === '') {
        await context.secrets.delete(REMOTE_TOKEN_KEY);
        vscode.window.showInformationMessage('Remote-agent token cleared.');
      } else {
        await context.secrets.store(REMOTE_TOKEN_KEY, token);
        vscode.window.showInformationMessage('Remote-agent token saved.');
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('audit.showGraph', () => GraphPanel.show(context, graph, nodes, bus, logger)),
    vscode.commands.registerCommand('audit.showDashboard', () => DashboardPanel.show(context, report, bus)),

    // Generate the audit report. Markdown opens as a document; HTML is written
    // to disk and opened in the browser (Print -> Save as PDF).
    vscode.commands.registerCommand('audit.generateReport', async (format?: string) => {
      const fmt = format ?? (await vscode.window.showQuickPick(['markdown', 'html'], { placeHolder: 'Report format' }));
      if (!fmt) {
        return;
      }
      const data = report.build();
      if (fmt === 'markdown') {
        const doc = await vscode.workspace.openTextDocument({ content: report.renderMarkdown(data), language: 'markdown' });
        await vscode.window.showTextDocument(doc, { preview: false });
        return;
      }
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
      const target = await vscode.window.showSaveDialog({
        saveLabel: 'Save report',
        filters: { HTML: ['html'] },
        defaultUri: folder ? vscode.Uri.joinPath(folder, 'audit-report.html') : undefined,
      });
      if (!target) {
        return;
      }
      await vscode.workspace.fs.writeFile(target, Buffer.from(report.renderHtml(data), 'utf8'));
      await vscode.env.openExternal(target);
    }),

    // Run external linters on the active file (dynamic enrichment).
    vscode.commands.registerCommand('audit.runLinters', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      if (!dynamic.enabled) {
        vscode.window.showWarningMessage('Dynamic analysis is off. Enable audit.dynamic.enabled to run external linters.');
        return;
      }
      const count = await runner.runDocument(editor.document.uri, editor.document);
      bus.emit('views:refresh', undefined);
      vscode.window.showInformationMessage(`Analysis complete: ${count} finding(s).`);
    }),

    // Report which external tools are installed.
    vscode.commands.registerCommand('audit.checkTools', async () => {
      const tools = await dynamic.detectTools();
      await vscode.window.showQuickPick(
        tools.map((t) => ({ label: `${t.available ? '$(check)' : '$(x)'} ${t.id}`, description: t.available ? t.command : `${t.command} not found` })),
        { placeHolder: 'External analysis tools' }
      );
    }),

    // Inspect a disk image with qemu-img (metadata only, no execution).
    vscode.commands.registerCommand('audit.inspectImage', async () => {
      const picked = await vscode.window.showOpenDialog({ canSelectMany: false, openLabel: 'Inspect image' });
      if (!picked || picked.length === 0) {
        return;
      }
      const uri = picked[0];
      const findings = await dynamic.inspectImage(uri.fsPath, relPath(uri));
      diagnostics.publish(uri, findings);
      vscode.window.showInformationMessage(findings.length ? findings[0].message : 'No image metadata (qemu-img unavailable or unsupported file).');
    })
  );

  const annotationService = new AnnotationService(annotations, bus, logger);
  annotationService.register(context);
  context.subscriptions.push({ dispose: () => annotationService.dispose() });

  // Re-analyze a document on save (live diagnostics).
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((doc: vscode.TextDocument) => {
      if (config.analyzeOnSave) {
        void runner.runDocument(doc.uri, doc, config.dynamicRunOnSave).then(() => bus.emit('views:refresh', undefined));
      }
    })
  );

  // --- Views ---------------------------------------------------------------
  const annotationsView = new AuditTreeProvider(annotations);
  const trustView = new TrustGraphTreeProvider(nodes);
  const knowledgeView = new KnowledgeTreeProvider(knowledge);
  const bookmarksView = new BookmarkTreeProvider(bookmarks);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('audit.annotations', annotationsView),
    vscode.window.registerTreeDataProvider('audit.trustGraph', trustView),
    vscode.window.registerTreeDataProvider('audit.knowledge', knowledgeView),
    vscode.window.registerTreeDataProvider('audit.bookmarks', bookmarksView)
  );

  bus.on('views:refresh', () => {
    annotationsView.refresh();
    trustView.refresh();
    knowledgeView.refresh();
    bookmarksView.refresh();
  });

  // --- Commands ------------------------------------------------------------
  registerCommands(context, { annotations, nodes, edges, knowledge, bookmarks, plugins, obsidian, runner, bus, logger });

  logger.info(`Audit Extension activated (AI: ${config.llmMode}, Obsidian: ${obsidian.isConfigured() ? 'on' : 'off'}, grammars: ${grammarsDir}).`);
}

export function deactivate(): void {
  // Resources are released via context.subscriptions.
}
