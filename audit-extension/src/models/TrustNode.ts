import { Id, NodeKind, TrustState } from '../core/Types';

/**
 * Nœud du graphe de confiance. `key` est stable et sert de clé de
 * réconciliation entre deux analyses successives (upsert).
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
