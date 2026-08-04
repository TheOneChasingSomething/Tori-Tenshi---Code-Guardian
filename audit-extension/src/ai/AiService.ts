import * as vscode from 'vscode';
import { Configuration } from '../core/Configuration';
import { Logger } from '../core/Logger';
import { LlmMode } from '../core/Types';
import { AiConnector, AiRequest, AiResponse } from './AiConnector';
import { LocalConnector } from './LocalConnector';
import { LocalLlmConnector } from './LocalLlmConnector';
import { RemoteAgentConnector } from './RemoteAgentConnector';

/** workspaceState key recording the one-time remote-agent consent. */
const CONSENT_KEY = 'audit.remoteAgent.consented';

/** The exact warning shown before the first external transmission. */
const CONSENT_WARNING =
  'You are about to send source code to an external service (Windsurf). ' +
  'Make sure this project can be shared in accordance with your security policy.';

/**
 * Selects the active AI connector from the configured mode and enforces the
 * cross-cutting privacy gates so individual connectors never have to. This is
 * the single choke point through which every AI request passes.
 *
 * Guarantees:
 *  - `local` mode never performs external inference;
 *  - no file matching the exclusion globs is ever sent to ANY model (local or
 *    remote) — only the fully local synthesis may process it;
 *  - the remote agent requires the explicit enable flag AND a one-time,
 *    recorded consent before a single byte leaves the machine.
 */
export class AiService {
  private readonly local: LocalConnector;
  private readonly localLlm: LocalLlmConnector;
  private readonly remote: RemoteAgentConnector;

  constructor(
    private readonly config: Configuration,
    private readonly logger: Logger,
    private readonly workspaceState: vscode.Memento,
    secrets: vscode.SecretStorage
  ) {
    this.local = new LocalConnector();
    this.localLlm = new LocalLlmConnector(config);
    this.remote = new RemoteAgentConnector(config, secrets);
  }

  /** The connector for the current mode. */
  private select(): AiConnector {
    switch (this.config.llmMode) {
      case LlmMode.LlmLocal:
        return this.localLlm;
      case LlmMode.RemoteAgent:
        return this.remote;
      default:
        return this.local;
    }
  }

  /** Human-readable status line for the "AI status" command. */
  status(): string {
    const mode = this.config.llmMode;
    if (mode === LlmMode.RemoteAgent) {
      const enabled = this.config.remoteAgentEnabled;
      const consented = this.workspaceState.get<boolean>(CONSENT_KEY, false);
      return `Mode: remote-agent - enabled: ${enabled} - consent: ${consented}`;
    }
    return `Mode: ${mode} (local, nothing leaves the machine)`;
  }

  /**
   * Runs the request through the selected connector after enforcing every gate.
   * Throws an Error with a user-facing message when a gate blocks the request.
   */
  async run(request: AiRequest): Promise<AiResponse> {
    const mode = this.config.llmMode;

    // Exclusion applies to any model inference (local model or remote agent).
    if (mode !== LlmMode.Local && !this.config.isTransmittable(request.relativePath)) {
      throw new Error(`"${request.relativePath}" matches an exclusion pattern and will not be sent to a model. Use local mode.`);
    }

    if (mode === LlmMode.RemoteAgent) {
      if (!this.config.remoteAgentEnabled) {
        throw new Error('Remote agent is disabled. Enable audit.remoteAgent.enabled first.');
      }
      if (!(await this.ensureConsent())) {
        throw new Error('Remote agent not authorized for this workspace.');
      }
    }

    const connector = this.select();
    this.logger.info(`AI request (${request.task}) via ${connector.id} for ${request.relativePath}.`);
    return connector.run(request);
  }

  /** Shows the consent dialog once per workspace; records the decision. */
  private async ensureConsent(): Promise<boolean> {
    if (this.workspaceState.get<boolean>(CONSENT_KEY, false)) {
      return true;
    }
    const choice = await vscode.window.showWarningMessage(CONSENT_WARNING, { modal: true }, 'I understand, authorize');
    const granted = choice === 'I understand, authorize';
    if (granted) {
      await this.workspaceState.update(CONSENT_KEY, true);
      this.logger.info('Remote-agent consent granted for this workspace.');
    }
    return granted;
  }

  /** Explicitly grants or revokes remote-agent consent (command-driven). */
  async setConsent(granted: boolean): Promise<void> {
    await this.workspaceState.update(CONSENT_KEY, granted);
    this.logger.info(`Remote-agent consent ${granted ? 'granted' : 'revoked'}.`);
  }
}
