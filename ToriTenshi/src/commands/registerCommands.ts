import * as vscode from 'vscode';
import * as path from 'path';
import { AnnotationStore } from '../persistence/ports';
import { TrustNodeStore } from '../persistence/ports';
import { TrustEdgeStore } from '../persistence/ports';
import { KnowledgeStore } from '../persistence/ports';
import { BookmarkStore } from '../persistence/ports';
import { PluginManager } from '../plugins/PluginManager';
import { ObsidianService } from '../obsidian/ObsidianService';
import { AnalysisRunner } from '../services/AnalysisRunner';
import { NOTE_TYPES, timestampId } from '../obsidian/noteTypes';
import { ObsidianNoteType } from '../models/KnowledgeNote';
import { EventBus } from '../core/EventBus';
import { Logger } from '../core/Logger';
import { Id, TrustState } from '../core/Types';

/** Dependencies injected into the command handlers. */
export interface CommandDeps {
  annotations: AnnotationStore;
  nodes: TrustNodeStore;
  edges: TrustEdgeStore;
  knowledge: KnowledgeStore;
  bookmarks: BookmarkStore;
  plugins: PluginManager;
  obsidian: ObsidianService;
  runner: AnalysisRunner;
  bus: EventBus;
  logger: Logger;
}

export function registerCommands(context: vscode.ExtensionContext, deps: CommandDeps): void {
  const { annotations, nodes, knowledge, bookmarks, obsidian, runner, bus } = deps;

  context.subscriptions.push(
    vscode.commands.registerCommand('audit.refreshViews', () => bus.emit('views:refresh', undefined)),

    // --- Workspace analysis (Phase 1, now via AnalysisRunner) --------------
    vscode.commands.registerCommand('audit.scanWorkspace', async () => {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Audit: analysis in progress…' },
        async () => {
          const { files, findings } = await runner.runWorkspace();
          vscode.window.showInformationMessage(`Audit complete: ${findings} finding(s) across ${files} file(s).`);
        }
      );
    }),

    // --- Annotations (Phase 1 + 2) -----------------------------------------
    vscode.commands.registerCommand('audit.addAnnotation', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('No active editor.');
        return;
      }
      const body = await vscode.window.showInputBox({ prompt: 'Annotation content' });
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
        author: process.env.USER ?? 'auditor',
      });
      bus.emit('annotation:changed', { file: editor.document.uri.fsPath });
      bus.emit('views:refresh', undefined);
    }),

    vscode.commands.registerCommand('audit.editAnnotation', async (id: Id) => {
      const current = annotations.findById(id);
      if (!current) {
        return;
      }
      const body = await vscode.window.showInputBox({ prompt: 'Edit annotation', value: current.body });
      if (body === undefined || body === current.body) {
        return;
      }
      annotations.edit(id, body);
      bus.emit('annotation:changed', { file: current.range.file });
      bus.emit('views:refresh', undefined);
    }),

    vscode.commands.registerCommand('audit.deleteAnnotation', async (id: Id) => {
      const current = annotations.findById(id);
      if (!current) {
        return;
      }
      const confirm = await vscode.window.showWarningMessage('Delete this annotation?', { modal: true }, 'Delete');
      if (confirm !== 'Delete') {
        return;
      }
      annotations.delete(id);
      bus.emit('annotation:changed', { file: current.range.file });
      bus.emit('views:refresh', undefined);
    }),

    vscode.commands.registerCommand('audit.showAnnotationHistory', async (id: Id) => {
      const revisions = annotations.getRevisions(id);
      if (revisions.length === 0) {
        vscode.window.showInformationMessage('No revision history.');
        return;
      }
      const items = revisions.map((r) => ({
        label: `rev. ${r.revision}`,
        description: new Date(r.createdAt).toLocaleString(),
        detail: r.body,
      }));
      await vscode.window.showQuickPick(items, { placeHolder: 'Annotation revision history' });
    }),

    // --- Advanced bookmarks (Phase 2) --------------------------------------
    vscode.commands.registerCommand('audit.toggleBookmark', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const file = editor.document.uri.fsPath;
      const line = editor.selection.active.line;
      const existing = bookmarks.findAt(file, line);
      if (existing) {
        bookmarks.delete(existing.id);
        bus.emit('views:refresh', undefined);
        return;
      }
      const label = await vscode.window.showInputBox({ prompt: 'Bookmark label', value: editor.document.lineAt(line).text.trim() });
      if (!label) {
        return;
      }
      const category = (await vscode.window.showInputBox({ prompt: 'Category', value: 'general' })) ?? 'general';
      bookmarks.create({
        range: { file, startLine: line, startChar: 0, endLine: line, endChar: 0 },
        label,
        category,
      });
      bus.emit('views:refresh', undefined);
    }),

    vscode.commands.registerCommand('audit.gotoBookmark', async () => {
      const all = bookmarks.all();
      if (all.length === 0) {
        vscode.window.showInformationMessage('No bookmarks yet.');
        return;
      }
      const pick = await vscode.window.showQuickPick(
        all.map((b) => ({ label: b.label, description: `[${b.category}] ${path.basename(b.range.file)}:${b.range.startLine + 1}`, bookmark: b })),
        { placeHolder: 'Go to bookmark' }
      );
      if (!pick) {
        return;
      }
      const b = pick.bookmark;
      await vscode.window.showTextDocument(vscode.Uri.file(b.range.file), {
        selection: new vscode.Range(b.range.startLine, 0, b.range.startLine, 0),
      });
    }),

    vscode.commands.registerCommand('audit.clearBookmarks', async () => {
      const confirm = await vscode.window.showWarningMessage('Clear all bookmarks?', { modal: true }, 'Clear');
      if (confirm !== 'Clear') {
        return;
      }
      bookmarks.clear();
      bus.emit('views:refresh', undefined);
    }),

    // --- Obsidian integration (Phase 2) ------------------------------------
    // Creates a knowledge note from the selection and, if a vault is configured,
    // writes it into the vault following the 5_Knowledges conventions.
    vscode.commands.registerCommand('audit.exportObsidian', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const sel = editor.selection;
      const excerpt = editor.document.getText(sel) || editor.document.lineAt(sel.start.line).text;
      const title = await vscode.window.showInputBox({ prompt: 'Note subject', value: path.basename(editor.document.fileName) });
      if (!title) {
        return;
      }
      const typePick = await vscode.window.showQuickPick(
        Object.keys(NOTE_TYPES).map((t) => ({ label: t, description: NOTE_TYPES[t as ObsidianNoteType].folder })),
        { placeHolder: 'Note type (5_Knowledges)' }
      );
      const type = (typePick?.label as ObsidianNoteType | undefined) ?? undefined;

      const content = [
        '```',
        excerpt,
        '```',
        '',
        '## Decisions',
        '',
        '## References',
        '',
      ].join('\n');

      const note = knowledge.create({
        title,
        content,
        sourceRange: { file: editor.document.uri.fsPath, startLine: sel.start.line, startChar: 0, endLine: sel.end.line, endChar: 0 },
        obsidianType: type,
        obsidianId: timestampId(),
      });

      if (obsidian.isConfigured()) {
        const res = await obsidian.export(note, type);
        vscode.window.showInformationMessage(res ? `Obsidian note created: ${path.basename(res.vaultPath)}` : 'Note saved (vault write failed).');
      } else {
        vscode.window.showInformationMessage('Note saved. Set audit.obsidian.vaultPath to export it to your vault.');
      }
      bus.emit('views:refresh', undefined);
    }),

    vscode.commands.registerCommand('audit.syncObsidian', async () => {
      if (!obsidian.isConfigured()) {
        vscode.window.showWarningMessage('Set audit.obsidian.vaultPath first.');
        return;
      }
      const count = await obsidian.syncPending();
      bus.emit('views:refresh', undefined);
      vscode.window.showInformationMessage(`Obsidian sync: ${count} note(s) written.`);
    }),

    vscode.commands.registerCommand('audit.openObsidianNote', async (noteId: Id) => {
      const note = knowledge.findById(noteId);
      if (!note?.obsidianPath) {
        vscode.window.showInformationMessage('This note has not been exported to the vault yet.');
        return;
      }
      await vscode.window.showTextDocument(vscode.Uri.file(note.obsidianPath));
    }),

    // --- Trust graph (Phase 1) ---------------------------------------------
    vscode.commands.registerCommand('audit.setNodeState', async (nodeKey?: string) => {
      const target = nodeKey ?? (await vscode.window.showQuickPick(nodes.all().map((n) => n.key), { placeHolder: 'Node to modify' }));
      if (!target) {
        return;
      }
      const node = nodes.findByKey(target);
      if (!node) {
        return;
      }
      const choice = await vscode.window.showQuickPick(Object.values(TrustState), { placeHolder: 'New state' });
      if (!choice) {
        return;
      }
      nodes.setState(node.id, choice as TrustState);
      bus.emit('trust:changed', { nodeKey: target });
      bus.emit('views:refresh', undefined);
    })
  );
}
