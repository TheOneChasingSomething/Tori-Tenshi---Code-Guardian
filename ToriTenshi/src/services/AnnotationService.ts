import * as vscode from 'vscode';
import { AnnotationStore } from '../persistence/ports';
import { AnnotationDecorations } from '../ui/AnnotationDecorations';
import { AnnotationCodeLensProvider } from '../ui/AnnotationCodeLensProvider';
import { AnnotationHoverProvider } from '../ui/AnnotationHoverProvider';
import { EventBus } from '../core/EventBus';
import { Logger } from '../core/Logger';

/**
 * Orchestrates the annotation "engine": editor decorations, hover and CodeLens
 * providers, and lightweight re-anchoring when the underlying text changes.
 *
 * Re-anchoring strategy (Phase 2): on every document edit that changes the line
 * count, annotations located strictly below the edit are shifted by the line
 * delta. This keeps anchors roughly correct during editing without a full
 * document-diff engine (deferred to a later phase).
 */
export class AnnotationService {
  private readonly decorations: AnnotationDecorations;
  private readonly codeLens: AnnotationCodeLensProvider;
  private readonly hover: AnnotationHoverProvider;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly repo: AnnotationStore,
    private readonly bus: EventBus,
    private readonly logger: Logger
  ) {
    this.decorations = new AnnotationDecorations(repo);
    this.codeLens = new AnnotationCodeLensProvider(repo);
    this.hover = new AnnotationHoverProvider(repo);
  }

  /** Registers providers and event listeners. Call once from activate(). */
  register(context: vscode.ExtensionContext): void {
    this.disposables.push(
      vscode.languages.registerCodeLensProvider({ scheme: 'file' }, this.codeLens),
      vscode.languages.registerHoverProvider({ scheme: 'file' }, this.hover),

      // Re-apply decorations when the active editor changes.
      vscode.window.onDidChangeActiveTextEditor((editor: vscode.TextEditor | undefined) => this.decorations.refresh(editor)),

      // Re-anchor annotations on line-count changes, then refresh visuals.
      vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => this.onDocumentChanged(e)),

      this.decorations
    );

    // Any data-level change (add/edit/delete) refreshes visuals + lenses.
    this.bus.on('annotation:changed', () => {
      this.decorations.refreshAll();
      this.codeLens.refresh();
    });
    this.bus.on('views:refresh', () => this.decorations.refreshAll());

    context.subscriptions.push(...this.disposables);
    this.decorations.refreshAll();
    this.logger.info('Annotation engine registered.');
  }

  private onDocumentChanged(e: vscode.TextDocumentChangeEvent): void {
    const file = e.document.uri.fsPath;
    let touched = false;

    for (const change of e.contentChanges) {
      const addedLines = (change.text.match(/\n/g) ?? []).length;
      const removedLines = change.range.end.line - change.range.start.line;
      const delta = addedLines - removedLines;
      if (delta === 0) {
        continue;
      }
      const pivot = change.range.start.line;
      for (const a of this.repo.findByFile(file)) {
        if (a.range.startLine > pivot) {
          this.repo.updateRange(
            a.id,
            a.range.startLine + delta,
            a.range.startChar,
            a.range.endLine + delta,
            a.range.endChar
          );
          touched = true;
        }
      }
    }

    if (touched) {
      this.codeLens.refresh();
    }
    // Decorations follow the text automatically via rangeBehavior, but a
    // refresh keeps hover messages aligned with re-anchored line numbers.
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.fsPath === file) {
      this.decorations.refresh(editor);
    }
  }

  refreshLenses(): void {
    this.codeLens.refresh();
  }

  dispose(): void {
    this.decorations.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
