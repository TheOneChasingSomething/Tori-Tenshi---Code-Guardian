import * as vscode from 'vscode';
import * as path from 'path';

/** Path of a document relative to its workspace folder (falls back to fsPath). */
export function relPath(uri: vscode.Uri): string {
  const folder = vscode.workspace.getWorkspaceFolder(uri);
  return folder ? path.relative(folder.uri.fsPath, uri.fsPath) : uri.fsPath;
}
