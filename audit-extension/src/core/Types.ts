/**
 * Cross-cutting types shared by every layer of the extension.
 * No dependency on the VS Code API here: these types must remain
 * testable in isolation (hexagonal-architecture rule).
 */

/** Opaque identifier of a persisted entity. */
export type Id = number;

/** Position inside a source file (0-based, VS Code convention). */
export interface SourceRange {
  file: string;      // path relative to the workspace root
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

/**
 * State of a node in the trust graph.
 * Mirrors the five states defined in the specification.
 */
export enum TrustState {
  Unreviewed = 'unreviewed',
  InProgress = 'in-progress',
  Validated = 'validated',
  AtRisk = 'at-risk',
  Documented = 'documented',
}

/** Severity of a finding produced by an analyzer. */
export enum Severity {
  Info = 'info',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

/** Operating mode of the AI connector. */
export enum LlmMode {
  Local = 'local',
  LlmLocal = 'llm-local',
  RemoteAgent = 'remote-agent',
}

/** Nature of a graph node (extensible by plugins). */
export type NodeKind =
  | 'function'
  | 'ansible-task'
  | 'container'
  | 'packer-image'
  | 'variable'
  | 'file'
  | 'role'
  | 'unknown';

/**
 * Finding emitted by a plugin analyzer.
 * Converted into a VS Code Diagnostic by the UI layer.
 */
export interface Finding {
  pluginId: string;
  ruleId: string;
  message: string;
  severity: Severity;
  range: SourceRange;
}

/** Logical node discovered by an analyzer, before persistence. */
export interface DiscoveredNode {
  key: string;        // stable key (e.g. "docker:image:ubuntu:22.04")
  label: string;
  kind: NodeKind;
  range?: SourceRange;
}

/** Edge (dependency) between two discovered nodes. */
export interface DiscoveredEdge {
  fromKey: string;
  toKey: string;
  label?: string;
}

/** Full result of a plugin analysis pass over a single file. */
export interface AnalysisResult {
  findings: Finding[];
  nodes: DiscoveredNode[];
  edges: DiscoveredEdge[];
}

/** Factory for an empty analysis result (avoids nulls). */
export function emptyAnalysis(): AnalysisResult {
  return { findings: [], nodes: [], edges: [] };
}
