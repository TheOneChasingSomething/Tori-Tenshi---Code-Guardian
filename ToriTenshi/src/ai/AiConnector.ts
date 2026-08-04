import { Finding } from '../core/Types';

/** What the user is asking the AI to do with a piece of code. */
export type AiTask = 'explain' | 'review' | 'summarize';

/** A request handed to a connector. Kept transport-neutral. */
export interface AiRequest {
  task: AiTask;
  languageId: string;
  /** Path relative to the workspace root (for context and provenance). */
  relativePath: string;
  code: string;
  /** Existing static/dynamic findings for this file, used to ground the prompt. */
  findings?: Finding[];
}

/** A connector's answer. */
export interface AiResponse {
  /** Markdown text produced by the connector. */
  text: string;
  /** Which connector produced it (for the header of the result document). */
  connectorId: string;
  /** True when the answer involved no external inference at all. */
  local: boolean;
}

/**
 * A source of AI assistance. Implementations must never transmit data unless it
 * is appropriate for their mode; the AiService enforces the cross-cutting gates
 * (consent, exclusion globs) before a connector is ever called.
 */
export interface AiConnector {
  readonly id: string;
  /** True when no code leaves the machine for this connector. */
  readonly isLocal: boolean;
  run(request: AiRequest): Promise<AiResponse>;
}
