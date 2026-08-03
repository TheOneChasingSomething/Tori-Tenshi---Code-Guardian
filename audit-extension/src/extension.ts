import * as vscode from 'vscode';
import { Logger } from './core/Logger';
import { EventBus } from './core/EventBus';
import { Configuration } from './core/Configuration';
import { AuditDatabase } from './persistence/Database';
import { AnnotationRepository } from './persistence/repositories/AnnotationRepository';
import { TrustNodeRepository } from './persistence/repositories/TrustNodeRepository';
import { TrustEdgeRepository } from './persistence/repositories/TrustEdgeRepository';
import { KnowledgeRepository } from './persistence/repositories/KnowledgeRepository';
import { BookmarkRepository } from './persistence/repositories/BookmarkRepository';
import { PluginManager } from './plugins/PluginManager';
import { DockerPlugin } from './plugins/builtin/DockerPlugin';
import { AnsiblePlugin } from './plugins/builtin/AnsiblePlugin';
import { PackerPlugin } from './plugins/builtin/PackerPlugin';
import { ObsidianService } from './obsidian/ObsidianService';
import { AnnotationService } from './services/AnnotationService';
import { AuditTreeProvider } from './ui/AuditTreeProvider';
import { TrustGraphTreeProvider } from './ui/TrustGraphTreeProvider';
import { KnowledgeTreeProvider } from './ui/KnowledgeTreeProvider';
import { BookmarkTreeProvider } from './ui/BookmarkTreeProvider';
import { registerCommands } from './commands/registerCommands';

/**
 * Entry point. VS Code calls `activate` once the activation event fires
 * (onStartupFinished). Here we assemble the dependency graph:
 * database -> repositories -> services (plugins, Obsidian, annotations) ->
 * views -> commands.
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

  // --- Services ------------------------------------------------------------
  const plugins = new PluginManager(logger, config);
  await plugins.register(new DockerPlugin());
  await plugins.register(new AnsiblePlugin());
  await plugins.register(new PackerPlugin());
  context.subscriptions.push({ dispose: () => plugins.dispose() });

  const obsidian = new ObsidianService(config, logger, knowledge);

  const annotationService = new AnnotationService(annotations, bus, logger);
  annotationService.register(context);
  context.subscriptions.push({ dispose: () => annotationService.dispose() });

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

  // Centralized view refresh through the event bus.
  bus.on('views:refresh', () => {
    annotationsView.refresh();
    trustView.refresh();
    knowledgeView.refresh();
    bookmarksView.refresh();
  });

  // --- Commands ------------------------------------------------------------
  registerCommands(context, { annotations, nodes, edges, knowledge, bookmarks, plugins, obsidian, bus, logger });

  logger.info(`Audit Extension activated (AI mode: ${config.llmMode}, Obsidian: ${obsidian.isConfigured() ? 'configured' : 'off'}).`);
}

export function deactivate(): void {
  // Resources are released via context.subscriptions.
}
