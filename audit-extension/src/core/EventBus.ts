/**
 * Bus d'événements typé et découplé.
 * Permet aux couches (persistance, analyse, UI) de communiquer sans
 * dépendances directes, ce qui facilite les tests et l'ajout de plugins.
 */
export type EventMap = {
  'annotation:changed': { file: string };
  'analysis:completed': { file: string; findingCount: number };
  'trust:changed': { nodeKey: string };
  'views:refresh': undefined;
};

type Handler<T> = (payload: T) => void;

export class EventBus {
  private readonly handlers = new Map<keyof EventMap, Set<Handler<unknown>>>();

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    // Retourne une fonction de désabonnement (pattern Disposable).
    return () => set!.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }
    for (const handler of set) {
      (handler as Handler<EventMap[K]>)(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
