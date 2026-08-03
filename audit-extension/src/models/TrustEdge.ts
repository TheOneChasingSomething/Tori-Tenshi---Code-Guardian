import { Id } from '../core/Types';

/** Directed edge between two nodes of the trust graph. */
export interface TrustEdge {
  id: Id;
  fromId: Id;
  toId: Id;
  label?: string;
}
