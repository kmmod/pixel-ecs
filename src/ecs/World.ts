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
import { OnEnter, OnExit, type StateToken, type StateValue } from "./State";

interface EntityOperations {
  get: <C>(token: RegistryToken<C>) => C | undefined;
  has: (...types: Queryable[]) => boolean;
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
  private states = new Map<
    StateToken<any>,
    { current: string; previous: string | null; dirty: boolean }
  >();
  private eventQueues = new Map<EventToken<unknown>, EventQueue<unknown>>();
  private systems = new Map<StageToken, SystemEntry[]>();

  private addedThisFrame = new Map<Queryable, Set<number>>();
  private removedThisFrame = new Map<Queryable, Set<number>>();

  private addedLastFrame = new Map<Queryable, Set<number>>();
  private removedLastFrame = new Map<Queryable, Set<number>>();

  private pendingDespawns = new Set<number>();

  // State management
  // Register a state machine
  public insertState<T extends string>(
    token: StateToken<T> & { initial: T },
  ): this {
    this.states.set(token, {
      current: token.initial,
      previous: null,
      dirty: true, // Run OnEnter for initial state
    });
    return this;
  }

  // Transition: world.setState(GameState.Running)
  public setState<T extends string>(stateValue: StateValue<T>): void {
    const entry = this.states.get(stateValue.state);
    if (!entry || entry.current === stateValue.value) return;

    entry.previous = entry.current;
    entry.current = stateValue.value;
    entry.dirty = true;
  }

  // Query: world.getState(GameState)
  public getState<T extends string>(token: StateToken<T>): T | undefined {
    return this.states.get(token)?.current as T | undefined;
  }

  private runStateTransitions(): void {
    for (const [token, entry] of this.states) {
      if (!entry.dirty) continue;

      // Run OnExit for previous state
      if (entry.previous !== null) {
        this.runStage(OnExit({ state: token, value: entry.previous }));
      }

      // Run OnEnter for current state
      this.runStage(OnEnter({ state: token, value: entry.current }));

      // Clear transition
      entry.previous = null;
      entry.dirty = false;
    }
  }

  // System registration
  public addSystem(
    stage: StageToken,
    system: System | System[],
    options?: SystemOptions,
  ): this {
    const systemsArray = Array.isArray(system) ? system : [system];
    for (const systemEntry of systemsArray) {
      const systems = this.systems.get(stage) ?? [];
      systems.push({ system: systemEntry, conditions: options?.when ?? [] });
      this.systems.set(stage, systems);
    }

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
    this.runStage(PreUpdate);
    this.runStateTransitions();
    this.runStage(Update);
    this.runStage(PostUpdate);
    this.runStage(Render);

    this.processDespawns();
    this.advanceEventFrames();
    this.advanceChangeTracking();
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

  private advanceChangeTracking(): void {
    this.addedLastFrame = this.addedThisFrame;
    this.removedLastFrame = this.removedThisFrame;
    this.addedThisFrame = new Map();
    this.removedThisFrame = new Map();
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

  // Query from last frame's changes
  public queryAdded<T extends Queryable[]>(...types: T): QueryResults<T>[] {
    // Get component types (exclude Entity)
    const componentTypes = types.filter((t) => t !== Entity);
    if (componentTypes.length === 0) return [];

    // Find entities where ANY of the component types were added
    const addedEntities = new Set<number>();
    for (const type of componentTypes) {
      const added = this.addedLastFrame.get(type);
      if (added) {
        for (const entity of added) {
          addedEntities.add(entity);
        }
      }
    }

    if (addedEntities.size === 0) return [];

    return this.query(...types).filter(([entity]) =>
      addedEntities.has(entity as number),
    );
  }

  public queryRemoved(...types: Queryable[]): number[] {
    const componentTypes = types.filter((t) => t !== Entity);
    if (componentTypes.length === 0) return [];

    // Find entities where ANY of the component types were removed
    const removedEntities = new Set<number>();
    for (const type of componentTypes) {
      const removed = this.removedLastFrame.get(type);
      if (removed) {
        for (const entity of removed) {
          removedEntities.add(entity);
        }
      }
    }

    return Array.from(removedEntities);
  }

  // Entities

  /**
   * Spawn a new entity with optional components
   * Spawn is immediate, systems will see the entity in the same frame
   */
  public spawn(...components: ComponentTuple[]): number {
    const entity = ++this.entityCounter;

    const componentMap = new Map<Queryable, unknown>();
    for (const [token, value] of components) {
      componentMap.set(token, value);
      if (!this.addedThisFrame.has(token)) {
        this.addedThisFrame.set(token, new Set());
      }
      this.addedThisFrame.get(token)!.add(entity);
    }
    this.entities.set(entity, componentMap);

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

    return entity;
  }

  public entity(entity: number): EntityOperations {
    const componentMap = this.entities.get(entity);
    const exists = !!componentMap;

    const ops: EntityOperations = {
      get: <C>(token: RegistryToken<C>): C | undefined => {
        if (!exists) return undefined;
        return componentMap.get(token) as C | undefined;
      },

      has: (...types: Queryable[]): boolean => {
        if (!exists) return false;
        return types.every((t) => componentMap.has(t));
      },
      insert: (...components: ComponentTuple[]) => {
        if (!exists) {
          return ops;
        }
        for (const [type, value] of components) {
          const isNew = !componentMap.has(type);
          componentMap.set(type, value);
          this.invalidateQueriesFor(type);

          if (isNew) {
            if (!this.addedThisFrame.has(type)) {
              this.addedThisFrame.set(type, new Set());
            }
            this.addedThisFrame.get(type)!.add(entity);
          }
        }
        return ops;
      },
      remove: (...types: Queryable[]) => {
        if (!exists) {
          return ops;
        }
        for (const type of types) {
          if (componentMap.has(type)) {
            componentMap.delete(type);
            this.invalidateQueriesFor(type);

            if (!this.removedThisFrame.has(type)) {
              this.removedThisFrame.set(type, new Set());
            }
            this.removedThisFrame.get(type)!.add(entity);
          }
        }
        return ops;
      },
      inspect: () => {
        if (!exists) return [];
        return Array.from(componentMap.values());
      },
      /*
       * Despawn the entity (deferred until end of frame)
       */
      despawn: () => {
        if (!exists) {
          return;
        }
        this.pendingDespawns.add(entity);
      },
    };

    return ops;
  }

  private processDespawns(): void {
    for (const entity of this.pendingDespawns) {
      const componentMap = this.entities.get(entity);
      if (!componentMap) continue;

      componentMap.forEach((_, type) => {
        if (!this.removedThisFrame.has(type)) {
          this.removedThisFrame.set(type, new Set());
        }
        this.removedThisFrame.get(type)!.add(entity);
        this.invalidateQueriesFor(type);
      });

      this.entities.delete(entity);
    }
    this.pendingDespawns.clear();
  }

  // Resources

  public insertResource<T>(...resources: [ResourceToken<T>, T][]): this {
    for (const [token, value] of resources) {
      this.resources.set(token, value);
    }
    return this;
  }

  public getResource<T>(token: ResourceToken<T>): T | undefined {
    return this.resources.get(token) as T | undefined;
  }

  public removeResource<T>(token: ResourceToken<T>): boolean {
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
