import { NodeKind, TrustState } from '../core/Types';

/** A node as sent to the webview (serializable, no DB ids leak semantics). */
export interface GraphNode {
  id: number;
  key: string;
  label: string;
  kind: NodeKind;
  state: TrustState;
  file?: string;
  /** Longest-path depth from a root; used by the layered layout. */
  depth: number;
}

/** A directed edge as sent to the webview. */
export interface GraphEdge {
  from: number;
  to: number;
  label?: string;
}

/** The full graph payload exchanged with the webview. */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Optional filter applied before building the payload. */
export interface GraphFilter {
  states?: TrustState[];
  kinds?: NodeKind[];
}
