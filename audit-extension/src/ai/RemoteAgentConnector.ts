import * as vscode from 'vscode';
import { AiConnector, AiRequest, AiResponse } from './AiConnector';
import { Configuration } from '../core/Configuration';
import { buildMessages } from './prompts';
import { chatCompletion } from './openaiClient';

/** SecretStorage key for the remote-agent bearer token. */
export const REMOTE_TOKEN_KEY = 'audit.remoteAgent.token';

/**
 * Remote-agent (Windsurf) connector. This is the only connector that transmits
 * source code off the machine. It never runs unless the AiService has already
 * verified the mode, the explicit enable flag, the one-time consent, and the
 * per-file exclusion globs. The bearer token is read from SecretStorage, never
 * from settings.
 */
export class RemoteAgentConnector implements AiConnector {
  readonly id = 'remote-agent';
  readonly isLocal = false;

  constructor(private readonly config: Configuration, private readonly secrets: vscode.SecretStorage) {}

  async run(request: AiRequest): Promise<AiResponse> {
    const endpoint = this.config.remoteAgentEndpoint;
    if (!endpoint) {
      throw new Error('No remote-agent endpoint configured (audit.remoteAgent.endpoint).');
    }
    const apiKey = await this.secrets.get(REMOTE_TOKEN_KEY);
    const text = await chatCompletion(buildMessages(request), {
      endpoint,
      model: this.config.llmModel,
      apiKey,
      timeoutMs: this.config.dynamicTimeoutMs,
    });
    return { text, connectorId: this.id, local: false };
  }
}
