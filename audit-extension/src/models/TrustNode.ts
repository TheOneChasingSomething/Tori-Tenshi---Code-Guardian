import { Id, NodeKind, TrustState } from '../core/Types';

/**
 * Node of the trust graph. `key` is stable and serves as the reconciliation
 * key between two successive analyses (upsert).
 */
export interface TrustNode {
  id: Id;
  key: string;
  label: string;
  kind: NodeKind;
  state: TrustState;
  file?: string;
  updatedAt: string;
}

export type NewTrustNode = Omit<TrustNode, 'id' | 'updatedAt'>;
