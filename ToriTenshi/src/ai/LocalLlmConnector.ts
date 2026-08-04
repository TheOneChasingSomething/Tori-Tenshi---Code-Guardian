import { AiConnector, AiRequest, AiResponse } from './AiConnector';
import { Configuration } from '../core/Configuration';
import { buildMessages } from './prompts';
import { chatCompletion } from './openaiClient';

/**
 * Local-model connector. Talks to an OpenAI-compatible endpoint running on the
 * machine (Ollama, LM Studio, vLLM) at `audit.llm.localEndpoint`. Data reaches
 * only that local endpoint; nothing is sent to the Internet.
 */
export class LocalLlmConnector implements AiConnector {
  readonly id = 'llm-local';
  readonly isLocal = true;

  constructor(private readonly config: Configuration) {}

  async run(request: AiRequest): Promise<AiResponse> {
    const text = await chatCompletion(buildMessages(request), {
      endpoint: this.config.localEndpoint,
      model: this.config.llmModel,
      timeoutMs: this.config.dynamicTimeoutMs,
    });
    return { text, connectorId: this.id, local: true };
  }
}
