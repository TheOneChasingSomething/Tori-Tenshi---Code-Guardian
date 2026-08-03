import * as vscode from 'vscode';
import { LlmMode } from './Types';

/**
 * Façade typée au-dessus de `vscode.workspace.getConfiguration('audit')`.
 * Centralise la lecture des paramètres et applique la politique de
 * confidentialité définie dans le cahier des charges (trois modes IA,
 * connecteur distant désactivé par défaut, motifs d'exclusion).
 */
export class Configuration {
  private cfg(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration('audit');
  }

  get llmMode(): LlmMode {
    const raw = this.cfg().get<string>('llm.mode', 'local');
    switch (raw) {
      case 'llm-local':
        return LlmMode.LlmLocal;
      case 'remote-agent':
        return LlmMode.RemoteAgent;
      default:
        return LlmMode.Local;
    }
  }

  get localEndpoint(): string {
    return this.cfg().get<string>('llm.localEndpoint', 'http://127.0.0.1:11434');
  }

  get remoteAgentEnabled(): boolean {
    return this.cfg().get<boolean>('remoteAgent.enabled', false);
  }

  get exclusionGlobs(): string[] {
    return this.cfg().get<string[]>('exclusionGlobs', []);
  }

  /**
   * Détermine si le mode « agent distant » (Windsurf) est réellement
   * utilisable : il faut à la fois que le mode soit sélectionné ET que
   * le drapeau explicite soit activé. Double barrière volontaire.
   */
  isRemoteAgentUsable(): boolean {
    return this.llmMode === LlmMode.RemoteAgent && this.remoteAgentEnabled;
  }

  /**
   * Vérifie qu'un fichier n'est pas exclu de toute transmission externe.
   * Conversion naïve glob -> RegExp suffisante pour les motifs simples
   * (`**`, `*`) ; sera remplacée par `minimatch` en Phase 6.
   */
  isTransmittable(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    for (const glob of this.exclusionGlobs) {
      if (Configuration.globToRegExp(glob).test(normalized)) {
        return false;
      }
    }
    return true;
  }

  private static globToRegExp(glob: string): RegExp {
    const escaped = glob
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '§DOUBLE§')
      .replace(/\*/g, '[^/]*')
      .replace(/§DOUBLE§/g, '.*');
    return new RegExp('^' + escaped + '$');
  }
}
