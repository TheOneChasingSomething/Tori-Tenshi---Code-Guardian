/**
 * Types transverses partagés par l'ensemble des couches de l'extension.
 * Aucune dépendance vers l'API VS Code ici : ces types doivent rester
 * testables en isolation (règle d'architecture hexagonale).
 */

/** Identifiant opaque d'une entité persistée. */
export type Id = number;

/** Position dans un fichier source (0-based, convention VS Code). */
export interface SourceRange {
  file: string;      // chemin relatif à la racine de l'espace de travail
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

/**
 * État d'un nœud dans le graphe de confiance.
 * Reprend les cinq états définis dans le cahier des charges.
 */
export enum TrustState {
  Unreviewed = 'unreviewed', // Non revu
  InProgress = 'in-progress', // En cours
  Validated = 'validated',    // Validé
  AtRisk = 'at-risk',         // À risque
  Documented = 'documented',  // Documenté
}

/** Sévérité d'un constat produit par un analyseur. */
export enum Severity {
  Info = 'info',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

/** Mode de fonctionnement du connecteur IA. */
export enum LlmMode {
  Local = 'local',
  LlmLocal = 'llm-local',
  RemoteAgent = 'remote-agent',
}

/** Nature d'un nœud du graphe (extensible par les plugins). */
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
 * Constat émis par un analyseur de plugin.
 * Sera converti en Diagnostic VS Code par la couche UI.
 */
export interface Finding {
  pluginId: string;
  ruleId: string;
  message: string;
  severity: Severity;
  range: SourceRange;
}

/** Nœud logique découvert par un analyseur, avant persistance. */
export interface DiscoveredNode {
  key: string;        // clé stable (ex. "docker:image:ubuntu:22.04")
  label: string;
  kind: NodeKind;
  range?: SourceRange;
}

/** Arête (dépendance) entre deux nœuds découverts. */
export interface DiscoveredEdge {
  fromKey: string;
  toKey: string;
  label?: string;
}

/** Résultat complet d'une passe d'analyse d'un plugin sur un fichier. */
export interface AnalysisResult {
  findings: Finding[];
  nodes: DiscoveredNode[];
  edges: DiscoveredEdge[];
}

/** Fabrique d'un résultat d'analyse vide (évite les null). */
export function emptyAnalysis(): AnalysisResult {
  return { findings: [], nodes: [], edges: [] };
}
