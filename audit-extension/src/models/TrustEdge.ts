import { Id } from '../core/Types';

/** Arête orientée entre deux nœuds du graphe de confiance. */
export interface TrustEdge {
  id: Id;
  fromId: Id;
  toId: Id;
  label?: string;
}
