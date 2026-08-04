import * as vscode from 'vscode';
import { AnnotationStore } from '../persistence/ports';

/**
 * Renders a CodeLens above each annotated range offering quick "Edit",
 * "History" and "Delete" actions. The provider fires `onDidChangeCodeLenses`
 * whenever annotations change, so the lenses stay in sync.
 */
export class AnnotationCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChange.event;

  constructor(private readonly repo: AnnotationStore) {}

  refresh(): void {
    this._onDidChange.fire();
  }

  provideCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
    return this.repo.findByFile(document.uri.fsPath).map((a) => {
      const range = new vscode.Range(a.range.startLine, 0, a.range.startLine, 0);
      const lens = new vscode.CodeLens(range);
      lens.command = {
        title: `$(note) annotation (rev. ${a.revision}) — edit`,
        command: 'audit.editAnnotation',
        arguments: [a.id],
      };
      return lens;
    });
  }
}
