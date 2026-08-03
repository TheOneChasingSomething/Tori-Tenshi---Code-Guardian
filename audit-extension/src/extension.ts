import * as vscode from 'vscode';
import { Logger } from './core/Logger';
import { EventBus } from './core/EventBus';
import { Configuration } from './core/Configuration';
import { AuditDatabase } from './persistence/Database';
import { AnnotationRepository } from './persistence/repositories/AnnotationRepository';
import { TrustNodeRepository } from './persistence/repositories/TrustNodeRepository';
import { TrustEdgeRepository } from './persistence/repositories/TrustEdgeRepository';
import { KnowledgeRepository } from './persistence/repositories/KnowledgeRepository';
import { PluginManager } from './plugins/PluginManager';
import { DockerPlugin } from './plugins/builtin/DockerPlugin';
import { AnsiblePlugin } from './plugins/builtin/AnsiblePlugin';
import { PackerPlugin } from './plugins/builtin/PackerPlugin';
import { AuditTreeProvider } from './ui/AuditTreeProvider';
import { TrustGraphTreeProvider } from './ui/TrustGraphTreeProvider';
import { KnowledgeTreeProvider } from './ui/KnowledgeTreeProvider';
import { registerCommands } from './commands/registerCommands';

/**
 * Point d'entrée. VS Code appelle `activate` une fois l'événement
 * d'activation déclenché (onStartupFinished). On y assemble le graphe de
 * dépendances : base -> dépôts -> gestionnaire de plugins -> vues -> commandes.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const logger = new Logger();
  context.subscriptions.push({ dispose: () => logger.dispose() });
  logger.info('Activation de Audit Extension…');

  const config = new Configuration();
  const bus = new EventBus();

  // --- Persistance ---------------------------------------------------------
  const storageDir = context.globalStorageUri.fsPath;
  const db = AuditDatabase.open(storageDir, logger);
  context.subscriptions.push({ dispose: () => db.close() });

  const annotations = new AnnotationRepository(db);
  const nodes = new TrustNodeRepository(db);
  const edges = new TrustEdgeRepository(db);
  const knowledge = new KnowledgeRepository(db);

  // --- Plugins -------------------------------------------------------------
  const plugins = new PluginManager(logger, config);
  await plugins.register(new DockerPlugin());
  await plugins.register(new AnsiblePlugin());
  await plugins.register(new PackerPlugin());
  context.subscriptions.push({ dispose: () => plugins.dispose() });

  // --- Vues ----------------------------------------------------------------
  const annotationsView = new AuditTreeProvider(annotations);
  const trustView = new TrustGraphTreeProvider(nodes);
  const knowledgeView = new KnowledgeTreeProvider(knowledge);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('audit.annotations', annotationsView),
    vscode.window.registerTreeDataProvider('audit.trustGraph', trustView),
    vscode.window.registerTreeDataProvider('audit.knowledge', knowledgeView)
  );

  // Rafraîchissement centralisé des vues via le bus d'événements.
  bus.on('views:refresh', () => {
    annotationsView.refresh();
    trustView.refresh();
    knowledgeView.refresh();
  });

  // --- Commandes -----------------------------------------------------------
  registerCommands(context, { annotations, nodes, edges, knowledge, plugins, bus, logger });

  logger.info(`Audit Extension activée (mode IA : ${config.llmMode}).`);
}

export function deactivate(): void {
  // Les ressources sont libérées via context.subscriptions.
}
