import { TrustNodeRepository } from '../persistence/repositories/TrustNodeRepository';
import { TrustEdgeRepository } from '../persistence/repositories/TrustEdgeRepository';
import { GraphData, GraphEdge, GraphFilter, GraphNode } from './GraphModel';

/**
 * Graph engine. Assembles the trust graph from persisted nodes and edges,
 * applies filters, and computes a per-node depth (longest path from a root) so
 * the webview can offer a layered "architecture" layout — the reverse-
 * engineering view from the specification, where one reads the dependency
 * chain playbook -> role -> image -> … from top to bottom.
 */
export class GraphService {
  constructor(private readonly nodes: TrustNodeRepository, private readonly edges: TrustEdgeRepository) {}

  build(filter?: GraphFilter): GraphData {
    let nodeList = this.nodes.all();
    if (filter?.states && filter.states.length > 0) {
      nodeList = nodeList.filter((n) => filter.states!.includes(n.state));
    }
    if (filter?.kinds && filter.kinds.length > 0) {
      nodeList = nodeList.filter((n) => filter.kinds!.includes(n.kind));
    }
    const kept = new Set(nodeList.map((n) => n.id));

    const edgeList: GraphEdge[] = this.edges
      .all()
      .filter((e) => kept.has(e.fromId) && kept.has(e.toId))
      .map((e) => ({ from: e.fromId, to: e.toId, label: e.label }));

    const depth = this.computeDepth(nodeList.map((n) => n.id), edgeList);

    const nodes: GraphNode[] = nodeList.map((n) => ({
      id: n.id,
      key: n.key,
      label: n.label,
      kind: n.kind,
      state: n.state,
      file: n.file,
      depth: depth.get(n.id) ?? 0,
    }));

    return { nodes, edges: edgeList };
  }

  /**
   * Longest-path depth per node via a memoized DFS. Cycles are broken by a
   * visited guard so the computation always terminates (depth caps at the
   * length of the longest acyclic path through each node).
   */
  private computeDepth(ids: number[], edges: GraphEdge[]): Map<number, number> {
    const successors = new Map<number, number[]>();
    const indegree = new Map<number, number>();
    for (const id of ids) {
      successors.set(id, []);
      indegree.set(id, 0);
    }
    for (const e of edges) {
      successors.get(e.from)?.push(e.to);
      indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);
    }

    const depth = new Map<number, number>();
    const inStack = new Set<number>();

    const visit = (id: number): number => {
      if (depth.has(id)) {
        return depth.get(id)!;
      }
      if (inStack.has(id)) {
        return 0; // cycle guard
      }
      inStack.add(id);
      let best = 0;
      for (const next of successors.get(id) ?? []) {
        best = Math.max(best, 1 + visit(next));
      }
      inStack.delete(id);
      depth.set(id, best);
      return best;
    };

    // Start from roots (indegree 0) then cover the rest.
    for (const id of ids) {
      if ((indegree.get(id) ?? 0) === 0) {
        visit(id);
      }
    }
    for (const id of ids) {
      visit(id);
    }
    return depth;
  }
}
