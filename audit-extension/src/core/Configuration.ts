import * as vscode from 'vscode';
import { LlmMode } from './Types';

/**
 * Typed facade over `vscode.workspace.getConfiguration('audit')`.
 * Centralizes reading of settings and enforces the privacy policy defined in
 * the specification (three AI modes, remote connector disabled by default,
 * exclusion globs).
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

  // --- Obsidian integration ------------------------------------------------

  /** Absolute path to the Obsidian vault root (empty disables export). */
  get obsidianVaultPath(): string {
    return this.cfg().get<string>('obsidian.vaultPath', '');
  }

  /** Knowledge root folder inside the vault (vault convention: 5_Knowledges). */
  get obsidianKnowledgeRoot(): string {
    return this.cfg().get<string>('obsidian.knowledgeRoot', '5_Knowledges');
  }

  /** Default note type used when exporting an audit note. */
  get obsidianDefaultNoteType(): import('../models/KnowledgeNote').ObsidianNoteType {
    return this.cfg().get<import('../models/KnowledgeNote').ObsidianNoteType>('obsidian.defaultNoteType', 'gist');
  }

  /** Name of the index note to reference in each note's Knowledge-index field. */
  get obsidianKnowledgeIndex(): string {
    return this.cfg().get<string>('obsidian.knowledgeIndex', '');
  }

  /**
   * Determines whether the "remote agent" (Windsurf) mode is actually usable:
   * both the mode must be selected AND the explicit flag enabled. Deliberate
   * double barrier.
   */
  isRemoteAgentUsable(): boolean {
    return this.llmMode === LlmMode.RemoteAgent && this.remoteAgentEnabled;
  }

  /**
   * Checks that a file is not excluded from any external transmission.
   * Naive glob -> RegExp conversion, sufficient for simple patterns
   * (`**`, `*`); to be replaced by `minimatch` in Phase 6.
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
