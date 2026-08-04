import { TrustNode } from '../models/TrustNode';
import { Annotation } from '../models/Annotation';
import { KnowledgeNote } from '../models/KnowledgeNote';

/** A finding as gathered from the diagnostics collection for the report. */
export interface ReportFinding {
  file: string;
  line: number;
  severity: string;
  source: string;
  code: string;
  message: string;
}

/** Aggregate counters shown on the dashboard and in the report header. */
export interface ReportStats {
  totalNodes: number;
  nodesByState: Record<string, number>;
  totalFindings: number;
  findingsBySeverity: Record<string, number>;
  findingsBySource: Record<string, number>;
  /** (validated + documented) / total nodes, as a 0..1 fraction. */
  coverage: number;
  annotations: number;
  bookmarks: number;
  notes: number;
}

/** Everything a rendered report contains. */
export interface ReportData {
  generatedAt: string;
  workspaceName: string;
  stats: ReportStats;
  findings: ReportFinding[];
  nodes: TrustNode[];
  annotations: Annotation[];
  notes: KnowledgeNote[];
}
