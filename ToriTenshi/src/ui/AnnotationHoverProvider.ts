import * as vscode from 'vscode';
import { AnnotationStore } from '../persistence/ports';

/**
 * Shows annotation content when hovering over an annotated range. Registered
 * for every language ('*'), it looks up annotations for the current file whose
 * range contains the hovered position.
 */
export class AnnotationHoverProvider implements vscode.HoverProvider {
  constructor(private readonly repo: AnnotationStore) {}

  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.ProviderResult<vscode.Hover> {
    const matches = this.repo
      .findByFile(document.uri.fsPath)
      .filter((a) => position.line >= a.range.startLine && position.line <= a.range.endLine);
    if (matches.length === 0) {
      return undefined;
    }
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    for (const a of matches) {
      md.appendMarkdown(`**Annotation** · rev. ${a.revision} · _${a.author}_\n\n${a.body}\n\n`);
    }
    return new vscode.Hover(md);
  }
}
