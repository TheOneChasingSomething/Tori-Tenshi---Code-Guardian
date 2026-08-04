import * as vscode from 'vscode';
import { AnnotationStore } from '../persistence/ports';

/**
 * Applies visual decorations to editors for annotated ranges: an overview-ruler
 * mark and a subtle background, so the reviewer sees at a glance which lines
 * carry review notes. The decoration type is created once and reused for every
 * editor (VS Code recommends a small, stable set of decoration types).
 */
export class AnnotationDecorations {
  private readonly decorationType: vscode.TextEditorDecorationType;

  constructor(private readonly repo: AnnotationStore) {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('editor.wordHighlightBackground'),
      overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.infoForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      isWholeLine: false,
      // Decoration follows text as it is edited above/below the range.
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
  }

  /** Recomputes and applies decorations for a single editor. */
  refresh(editor: vscode.TextEditor | undefined): void {
    if (!editor) {
      return;
    }
    const file = editor.document.uri.fsPath;
    const options: vscode.DecorationOptions[] = this.repo.findByFile(file).map((a) => ({
      range: new vscode.Range(a.range.startLine, a.range.startChar, a.range.endLine, a.range.endChar),
      hoverMessage: new vscode.MarkdownString(`**Annotation** (rev. ${a.revision})\n\n${a.body}`),
    }));
    editor.setDecorations(this.decorationType, options);
  }

  /** Applies decorations to all currently visible editors. */
  refreshAll(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.refresh(editor);
    }
  }

  dispose(): void {
    this.decorationType.dispose();
  }
}
