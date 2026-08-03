import { AnalysisResult } from '../core/Types';
import { Logger } from '../core/Logger';
import { Configuration } from '../core/Configuration';

/**
 * Contexte fourni à chaque plugin à son initialisation. Il expose des
 * services partagés sans coupler le plugin au reste de l'extension :
 * un plugin ne connaît que cette interface.
 */
export interface PluginContext {
  readonly logger: Logger;
  readonly config: Configuration;
}

/** Document à analyser, transmis au plugin sous forme neutre. */
export interface AnalyzableDocument {
  /** Chemin relatif à la racine de l'espace de travail. */
  relativePath: string;
  /** Identifiant de langage VS Code (ex. "dockerfile", "yaml", "python"). */
  languageId: string;
  /** Contenu textuel du fichier. */
  text: string;
}

/**
 * Contrat que doit implémenter chaque analyseur technologique.
 * L'ajout d'un langage se limite à fournir une nouvelle implémentation :
 * aucune modification du cœur n'est requise (principe ouvert/fermé).
 */
export interface AuditPlugin {
  /** Identifiant unique et stable (ex. "docker", "ansible"). */
  readonly id: string;

  /** Nom lisible affiché dans l'interface. */
  readonly displayName: string;

  /**
   * Langages ou extensions pris en charge. Utilisé par le PluginManager
   * pour router un document vers les bons analyseurs.
   */
  readonly languageIds: string[];

  /** Initialisation optionnelle (chargement de grammaires, LSP, etc.). */
  activate?(ctx: PluginContext): void | Promise<void>;

  /**
   * Analyse statique d'un document. Doit être pure : pas d'effet de bord,
   * pas d'accès disque hors du texte fourni. Renvoie constats + nœuds/arêtes.
   */
  analyze(doc: AnalyzableDocument, ctx: PluginContext): AnalysisResult | Promise<AnalysisResult>;

  /** Libération des ressources éventuelles. */
  dispose?(): void;
}
