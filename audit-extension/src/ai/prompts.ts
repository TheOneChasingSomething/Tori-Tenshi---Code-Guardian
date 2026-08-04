import { AiRequest } from './AiConnector';
import { ChatMessage } from './openaiClient';

/** System prompt establishing the assistant's role for a security review. */
const SYSTEM = [
  'You are a code-security reviewer embedded in an audit tool.',
  'Be precise and concise. Prefer concrete, actionable observations.',
  'When you flag an issue, name the mechanism and, where relevant, the CWE.',
  'Do not invent APIs or behaviour that is not visible in the provided code.',
].join(' ');

/** Task-specific instruction. */
function instruction(request: AiRequest): string {
  switch (request.task) {
    case 'explain':
      return 'Explain what this code does, step by step, for a reviewer seeing it for the first time.';
    case 'review':
      return 'Review this code for security and correctness issues. List findings with severity and a short rationale.';
    case 'summarize':
      return 'Summarize the purpose, inputs, outputs, and trust boundaries of this code in a few sentences.';
  }
}

/** Builds the chat messages, grounding the model with any existing findings. */
export function buildMessages(request: AiRequest): ChatMessage[] {
  const findingsBlock =
    request.findings && request.findings.length > 0
      ? '\n\nStatic/dynamic findings already reported for this file:\n' +
        request.findings.map((f) => `- [${f.severity}] ${f.ruleId}: ${f.message}`).join('\n')
      : '';

  const user = [
    `${instruction(request)}`,
    `\nFile: ${request.relativePath} (language: ${request.languageId})`,
    findingsBlock,
    '\n\nCode:\n```',
    request.code,
    '```',
  ].join('\n');

  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ];
}
