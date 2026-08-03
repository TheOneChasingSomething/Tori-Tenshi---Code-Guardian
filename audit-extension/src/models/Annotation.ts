import { Id, SourceRange } from '../core/Types';

/**
 * Annotation attachée à une portion de code. Chaque annotation est
 * versionnée (cf. « Historique de la compréhension » du cahier des charges) :
 * une modification crée une nouvelle révision plutôt qu'un écrasement.
 */
export interface Annotation {
  id: Id;
  range: SourceRange;
  body: string;
  author: string;
  revision: number;      // incrémenté à chaque édition
  createdAt: string;     // ISO-8601
  updatedAt: string;     // ISO-8601
}

export type NewAnnotation = Omit<Annotation, 'id' | 'revision' | 'createdAt' | 'updatedAt'>;
