import {
  register,
  TOKEN_ID,
  type ComponentTuple,
  type EventToken,
  type RegistryToken,
  type ResourceToken,
} from "./Registry";
import type { CachedQuery, Queryable, QueryResults } from "./Query";
import {
  PostUpdate,
  PreUpdate,
  Render,
  Startup,
  Update,
  type StageToken,
  type System,
  type SystemEntry,
  type SystemOptions,
} from "./Systems";
import { EventQueue, EventReader, EventWriter } from "./Event";

interface EntityOperations {
  insert: (...components: ComponentTuple[]) => EntityOperations;
  remove: (...types: Queryable[]) => EntityOperations;
  inspect: () => unknown[];
  despawn: () => void;
}

export const Entity = register<number>();

export class World {
  private entityCounter = 0;
  private entities = new Map<number, Map<Queryable, unknown>>();
  private queryCache = new Map<string, CachedQuery<Queryable[]>>();
  private resources = new Map<RegistryToken<unknown>, unknown>();
  private eventQueues = new Map<EventToken<unknown>, EventQueue<unknown>>();
  private systems = new Map<StageToken, SystemEntry[]>();

  // Systems
  // Stage execution order
  private readonly updateStages: StageToken[] = [
    PreUpdate,
    Update,
    PostUpdate,
    Render,
  ];

  // System registration
  public addSystem(
    stage: StageToken,
    system: System,
    options?: SystemOptions,
  ): this {
    const systems = this.systems.get(stage) ?? [];
    systems.push({ system, conditions: options?.when ?? [] });
    this.systems.set(stage, systems);
    return this;
  }

  // Run systems for a specific stage
  private runStage(stage: StageToken): void {
    const systems = this.systems.get(stage) ?? [];
    for (const { system, conditions } of systems) {
      if (conditions.every((cond) => cond(this))) {
        system(this);
      }
    }
  }

  // Must be called first (maybe time should be inserted separately? or loop should be separate from world?)
  public init(): void {
    this.runStage(Startup);
  }

  public async initAsync(): Promise<void> {
    // For async startup systems in the future
    // Warmup rendering, download assets etc
  }

  public update() {
    for (const stage of this.updateStages) {
      this.runStage(stage);
    }
    this.advanceEventFrames();
  }

  // Queries (with caching)

  private getQueryKey(types: Queryable[]): string {
    return types.map((t) => t[TOKEN_ID]).join(":");
  }

  private invalidateQueriesFor(token: Queryable): void {
    for (const [_, cached] of this.queryCache) {
      if (cached.types.includes(token)) {
        cached.dirty = true;
      }
    }
  }

  // TODO: implement Query filters: {with, without, optional}
  // Then imeplement lifecycle filters: {added, removed, changed}
  // - maybe queue them in one frame, and then process in the second frame, and then discard?
  // Proxy object to listen for component changes
  // Maybe also add 'observers' that trigger immediately on component changes?
  //   world.addObserver(OnAdd<T>(callback))
  public query<T extends Queryable[]>(...types: T): QueryResults<T>[] {
    const key = this.getQueryKey(types);

    const cached = this.queryCache.get(key) as CachedQuery<T> | undefined;
    if (cached && !cached.dirty) {
      return cached.results;
    }

    const results: QueryResults<T>[] = [];

    for (const [entity, components] of this.entities) {
      const tuple: unknown[] = [];
      let hasAll = true;

      for (const token of types) {
        if (token === Entity) {
          tuple.push(entity);
        } else {
          const value = components.get(token);
          if (value !== undefined) {
            tuple.push(value);
          } else {
            hasAll = false;
            break;
          }
        }
      }

      this.queryCache.set(key, {
        types,
        results,
        dirty: false,
      } as CachedQuery<Queryable[]>);

      if (hasAll) {
        results.push(tuple as QueryResults<T>);
      }
    }

    return results;
  }

  // Entities

  public spawn(...components: ComponentTuple[]): number {
    this.entityCounter++;
    const componentMap = new Map<Queryable, unknown>();
    for (const [token, value] of components) {
      componentMap.set(token, value);
    }
    this.entities.set(this.entityCounter, componentMap);

    // if there are not components invalidate caches for queries
    if (components.length === 0) {
      for (const [_, cached] of this.queryCache) {
        cached.dirty = true;
      }
    } else {
      // Otherwise only invalidate for the components added
      for (const [token, _] of components) {
        this.invalidateQueriesFor(token);
      }
    }

    return this.entityCounter;
  }

  public entity(entity: number): EntityOperations {
    const componentMap = this.entities.get(entity);
    const exists = !!componentMap;

    const ops: EntityOperations = {
      insert: (...components: ComponentTuple[]) => {
        if (!exists) {
          return ops;
        }
        for (const [type, value] of components) {
          componentMap?.set(type, value);
          this.invalidateQueriesFor(type);
        }
        return ops;
      },
      remove: (...types: Queryable[]) => {
        if (!exists) {
          return ops;
        }
        for (const type of types) {
          componentMap?.delete(type);
          this.invalidateQueriesFor(type);
        }
        return ops;
      },
      inspect: () => {
        if (!exists) return [];
        return Array.from(componentMap.values());
      },
      despawn: () => {
        if (!exists) {
          return;
        }
        this.entities.delete(entity);
        componentMap?.forEach((_, type) => {
          this.invalidateQueriesFor(type);
        });
      },
    };

    return ops;
  }

  // Resources

  public insertRes<T>(...resources: [ResourceToken<T>, T][]): this {
    for (const [token, value] of resources) {
      this.resources.set(token, value);
    }
    return this;
  }

  public getRes<T>(token: ResourceToken<T>): T | undefined {
    return this.resources.get(token) as T | undefined;
  }

  public removeRes<T>(token: ResourceToken<T>): boolean {
    return this.resources.delete(token);
  }

  // Events

  public getEventWriter<T>(token: EventToken<T>): EventWriter<T> {
    let queue = this.eventQueues.get(token) as EventQueue<T> | undefined;
    if (!queue) {
      queue = new EventQueue<T>();
      this.eventQueues.set(token, queue);
    }
    return new EventWriter(queue);
  }

  public getEventReader<T>(token: EventToken<T>): EventReader<T> {
    let queue = this.eventQueues.get(token) as EventQueue<T> | undefined;
    if (!queue) {
      queue = new EventQueue<T>();
      this.eventQueues.set(token, queue);
    }
    return new EventReader(queue);
  }

  private advanceEventFrames(): void {
    for (const queue of this.eventQueues.values()) {
      queue.nextFrame();
    }
  }
}
