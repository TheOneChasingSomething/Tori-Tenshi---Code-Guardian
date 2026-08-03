import * as vscode from 'vscode';
import * as path from 'path';
import { AnnotationRepository } from '../persistence/repositories/AnnotationRepository';
import { TrustNodeRepository } from '../persistence/repositories/TrustNodeRepository';
import { TrustEdgeRepository } from '../persistence/repositories/TrustEdgeRepository';
import { KnowledgeRepository } from '../persistence/repositories/KnowledgeRepository';
import { PluginManager } from '../plugins/PluginManager';
import { EventBus } from '../core/EventBus';
import { Logger } from '../core/Logger';
import { TrustState } from '../core/Types';

/** Dépendances injectées aux gestionnaires de commandes. */
export interface CommandDeps {
  annotations: AnnotationRepository;
  nodes: TrustNodeRepository;
  edges: TrustEdgeRepository;
  knowledge: KnowledgeRepository;
  plugins: PluginManager;
  bus: EventBus;
  logger: Logger;
}

/** Chemin relatif d'un document à la racine de l'espace de travail. */
function relPath(uri: vscode.Uri): string {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  return folder ? path.relative(folder.uri.fsPath, uri.fsPath) : uri.fsPath;
}

export function registerCommands(context: vscode.ExtensionContext, deps: CommandDeps): void {
  const { annotations, nodes, edges, knowledge, plugins, bus, logger } = deps;

  context.subscriptions.push(
    vscode.commands.registerCommand('audit.refreshViews', () => bus.emit('views:refresh', undefined)),

    // Analyse de tout l'espace de travail : parcourt les documents ouverts et
    // les fichiers, route chacun vers les plugins, persiste nœuds et arêtes.
    vscode.commands.registerCommand('audit.scanWorkspace', async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Audit : analyse en cours…' },
        async () => {
          const uris = await vscode.workspace.findFiles('**/*', '**/node_modules/**', 2000);
          let totalFindings = 0;
          for (const uri of uris) {
            let document: vscode.TextDocument;
            try {
              document = await vscode.workspace.openTextDocument(uri);
            } catch {
              continue;
            }
            const result = await plugins.analyze({
              relativePath: relPath(uri),
              languageId: document.languageId,
              text: document.getText(),
            });
            totalFindings += result.findings.length;

            // Persistance des nœuds puis des arêtes (résolution des clés -> ids).
            const keyToId = new Map<string, number>();
            for (const n of result.nodes) {
              const saved = nodes.upsert({ key: n.key, label: n.label, kind: n.kind, state: TrustState.Unreviewed, file: n.range?.file });
              keyToId.set(n.key, saved.id);
            }
            for (const e of result.edges) {
              const from = keyToId.get(e.fromKey);
              const to = keyToId.get(e.toKey);
              if (from && to) {
                edges.upsert(from, to, e.label);
              }
            }
            bus.emit('analysis:completed', { file: relPath(uri), findingCount: result.findings.length });
          }
          bus.emit('views:refresh', undefined);
          vscode.window.showInformationMessage(`Audit terminé : ${totalFindings} constat(s) sur ${uris.length} fichier(s).`);
          logger.info(`Analyse terminée : ${totalFindings} constats.`);
        }
      );
    }),

    // Ajout d'une annotation sur la sélection courante.
    vscode.commands.registerCommand('audit.addAnnotation', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('Aucun éditeur actif.');
        return;
      }
      const body = await vscode.window.showInputBox({ prompt: 'Contenu de l’annotation' });
      if (!body) {
        return;
      }
      const sel = editor.selection;
      annotations.create({
        range: {
          file: editor.document.uri.fsPath,
          startLine: sel.start.line,
          startChar: sel.start.character,
          endLine: sel.end.line,
          endChar: sel.end.character,
        },
        body,
        author: process.env.USER ?? 'auditeur',
      });
      bus.emit('annotation:changed', { file: editor.document.uri.fsPath });
      bus.emit('views:refresh', undefined);
    }),

    // Changement d'état d'un nœud de confiance via QuickPick.
    vscode.commands.registerCommand('audit.setNodeState', async (nodeKey?: string) => {
      const target = nodeKey ?? (await vscode.window.showQuickPick(nodes.all().map((n) => n.key), { placeHolder: 'Nœud à modifier' }));
      if (!target) {
        return;
      }
      const node = nodes.findByKey(target);
      if (!node) {
        return;
      }
      const choice = await vscode.window.showQuickPick(Object.values(TrustState), { placeHolder: 'Nouvel état' });
      if (!choice) {
        return;
      }
      nodes.setState(node.id, choice as TrustState);
      bus.emit('trust:changed', { nodeKey: target });
      bus.emit('views:refresh', undefined);
    }),

    // Export d'une note vers Obsidian (CTRL+Shift+O). L'écriture réelle dans
    // le coffre est déléguée à l'intégration Obsidian de la Phase 2 ; ici la
    // note est enregistrée en base et son emplacement cible calculé.
    vscode.commands.registerCommand('audit.exportObsidian', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const sel = editor.selection;
      const excerpt = editor.document.getText(sel) || editor.document.lineAt(sel.start.line).text;
      const title = await vscode.window.showInputBox({ prompt: 'Titre de la note Obsidian', value: path.basename(editor.document.fileName) });
      if (!title) {
        return;
      }
      const content = [
        `# ${title}`,
        '',
        `> Source : \`${relPath(editor.document.uri)}\` (L${sel.start.line + 1})`,
        '',
        '```',
        excerpt,
        '```',
        '',
        '## Décisions',
        '',
        '## Références',
        '',
      ].join('\n');
      knowledge.create({
        title,
        content,
        sourceRange: { file: editor.document.uri.fsPath, startLine: sel.start.line, startChar: 0, endLine: sel.end.line, endChar: 0 },
      });
      bus.emit('views:refresh', undefined);
      vscode.window.showInformationMessage(`Note « ${title} » enregistrée (export coffre Obsidian : Phase 2).`);
    })
  );
}
