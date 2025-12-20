import {
  register,
  TOKEN_ID,
  type ComponentTuple,
  type EventToken,
  type RegistryToken,
  type ResourceToken,
} from "./Registry";
import type { Queryable, QueryResults } from "./Query";
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

export const Entity = register<number>();

type Archetype = {
  id: number;
  signature: Set<Queryable>;
  columns: Map<Queryable, unknown[]>;
  entities: number[];
};

type EntityRecord = {
  archetype: Archetype;
  row: number;
};

interface EntityOperations {
  get: <C>(token: RegistryToken<C>) => C | undefined;
  has: (...types: Queryable[]) => boolean;
  insert: (...components: ComponentTuple[]) => EntityOperations;
  remove: (...types: Queryable[]) => EntityOperations;
  inspect: () => unknown[];
  despawn: () => void;
}

export class World {
  private entityCounter = 0;

  // Archetype storage
  private entityRecords: (EntityRecord | null)[] = [];
  private archetypes = new Map<string, Archetype>();
  private archetypeCounter = 0;

  // Query cache: query signature -> matching archetypes
  private queryCache = new Map<string, Archetype[]>();

  // Resources
  private resources = new Map<RegistryToken<unknown>, unknown>();

  // States
  private states = new Map<
    StateToken<any>,
    { current: string; previous: string | null; dirty: boolean }
  >();

  // Events
  private eventQueues = new Map<EventToken<unknown>, EventQueue<unknown>>();

  // Systems
  private systems = new Map<StageToken, SystemEntry[]>();

  // Change tracking
  private addedThisFrame = new Map<Queryable, Set<number>>();
  private removedThisFrame = new Map<Queryable, Set<number>>();
  private addedLastFrame = new Map<Queryable, Set<number>>();
  private removedLastFrame = new Map<Queryable, Set<number>>();

  // Deferred operations
  private pendingDespawns = new Set<number>();

  // ============================================================
  // Archetype helpers
  // ============================================================

  private getSignatureKey(types: Iterable<Queryable>): string {
    return [...types]
      .map((t) => t[TOKEN_ID])
      .sort((a, b) => a - b)
      .join(":");
  }

  private getOrCreateArchetype(signature: Set<Queryable>): Archetype {
    const key = this.getSignatureKey(signature);
    let archetype = this.archetypes.get(key);

    if (!archetype) {
      archetype = {
        id: this.archetypeCounter++,
        signature,
        columns: new Map(),
        entities: [],
      };

      for (const token of signature) {
        archetype.columns.set(token, []);
      }

      this.archetypes.set(key, archetype);
      this.invalidateQueryCache();
    }

    return archetype;
  }

  private invalidateQueryCache(): void {
    this.queryCache.clear();
  }

  // Warm up an archetype for the given component types
  public registerArchetype(...tokens: Queryable[]): this {
    this.getOrCreateArchetype(new Set(tokens));
    return this;
  }

  // ============================================================
  // State management
  // ============================================================

  public insertState<T extends string>(
    token: StateToken<T> & { initial: T },
  ): this {
    this.states.set(token, {
      current: token.initial,
      previous: null,
      dirty: true,
    });
    return this;
  }

  public setState<T extends string>(stateValue: StateValue<T>): void {
    const entry = this.states.get(stateValue.state);
    if (!entry || entry.current === stateValue.value) return;

    entry.previous = entry.current;
    entry.current = stateValue.value;
    entry.dirty = true;
  }

  public getState<T extends string>(token: StateToken<T>): T | undefined {
    return this.states.get(token)?.current as T | undefined;
  }

  private runStateTransitions(): void {
    for (const [token, entry] of this.states) {
      if (!entry.dirty) continue;

      if (entry.previous !== null) {
        this.runStage(OnExit({ state: token, value: entry.previous }));
      }

      this.runStage(OnEnter({ state: token, value: entry.current }));

      entry.previous = null;
      entry.dirty = false;
    }
  }

  // ============================================================
  // Systems
  // ============================================================

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

  private runStage(stage: StageToken): void {
    const systems = this.systems.get(stage) ?? [];
    for (const { system, conditions } of systems) {
      if (conditions.every((cond) => cond(this))) {
        system(this);
      }
    }
  }

  // ============================================================
  // Lifecycle
  // ============================================================

  public init(): void {
    this.runStage(Startup);
  }

  public async initAsync(): Promise<void> {
    // For async startup systems in the future
  }

  public update(): void {
    this.runStage(PreUpdate);
    this.runStateTransitions();
    this.runStage(Update);
    this.runStage(PostUpdate);
    this.runStage(Render);

    this.processDespawns();
    this.advanceEventFrames();
    this.advanceChangeTracking();
  }

  // ============================================================
  // Queries
  // ============================================================

  private getMatchingArchetypes(types: Queryable[]): Archetype[] {
    const key = this.getSignatureKey(types.filter((t) => t !== Entity));
    let cached = this.queryCache.get(key);

    if (!cached) {
      cached = [];
      const queryTypes = types.filter((t) => t !== Entity);

      for (const archetype of this.archetypes.values()) {
        if (queryTypes.every((t) => archetype.signature.has(t))) {
          cached.push(archetype);
        }
      }
      this.queryCache.set(key, cached);
    }

    return cached;
  }

  public query<T extends Queryable[]>(...types: T): QueryResults<T>[] {
    const archetypes = this.getMatchingArchetypes(types);
    const results: QueryResults<T>[] = [];

    for (const archetype of archetypes) {
      const len = archetype.entities.length;

      const columns = types.map((t) =>
        t === Entity ? archetype.entities : archetype.columns.get(t)!,
      );

      for (let row = 0; row < len; row++) {
        const tuple = columns.map((col) => col[row]) as QueryResults<T>;
        results.push(tuple);
      }
    }

    return results;
  }

  public queryAdded<T extends Queryable[]>(...types: T): QueryResults<T>[] {
    const componentTypes = types.filter((t) => t !== Entity);
    if (componentTypes.length === 0) return [];

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

  // ============================================================
  // Entities
  // ============================================================

  public spawn(...components: ComponentTuple[]): number {
    const entity = ++this.entityCounter;
    const signature = new Set<Queryable>(components.map(([token]) => token));
    const archetype = this.getOrCreateArchetype(signature);

    const row = archetype.entities.length;
    archetype.entities.push(entity);

    for (const [token, value] of components) {
      archetype.columns.get(token)!.push(value);

      // Track additions
      if (!this.addedThisFrame.has(token)) {
        this.addedThisFrame.set(token, new Set());
      }
      this.addedThisFrame.get(token)!.add(entity);
    }

    this.entityRecords[entity] = { archetype, row };

    return entity;
  }

  /**
   * Spawns a batch of entities using the provided factory function to generate components.
   *
   * ```ts
   * world.spawnBatch(1000, () => [
   *    Position(Math.random() * 100, Math.random() * 100),
   *    Velocity(1, 1)
   * ]);
   *````
   *
   * @param count
   * @param factory
   * @returns
   */
  public spawnBatch(count: number, factory: () => ComponentTuple[]): number[] {
    const entities: number[] = [];

    // Get archetype once from first entity's components
    const templateComponents = factory();
    const signature = new Set<Queryable>(
      templateComponents.map(([token]) => token),
    );
    const archetype = this.getOrCreateArchetype(signature);

    for (let i = 0; i < count; i++) {
      const entity = ++this.entityCounter;
      const components = i === 0 ? templateComponents : factory();

      const row = archetype.entities.length;
      archetype.entities.push(entity);

      for (const [token, value] of components) {
        archetype.columns.get(token)!.push(value);

        if (!this.addedThisFrame.has(token)) {
          this.addedThisFrame.set(token, new Set());
        }
        this.addedThisFrame.get(token)!.add(entity);
      }

      this.entityRecords[entity] = { archetype, row };
      entities.push(entity);
    }

    return entities;
  }

  public entity(entityId: number): EntityOperations {
    const record = this.entityRecords[entityId];
    const exists = !!record;

    const ops: EntityOperations = {
      get: <C>(token: RegistryToken<C>): C | undefined => {
        if (!exists) return undefined;
        const col = record.archetype.columns.get(token);
        return col?.[record.row] as C | undefined;
      },

      has: (...types: Queryable[]): boolean => {
        if (!exists) return false;
        return types.every((t) => record.archetype.signature.has(t));
      },

      insert: (...components: ComponentTuple[]) => {
        if (!exists) return ops;

        const oldArchetype = record.archetype;
        const oldRow = record.row;

        // Check if we need to move to a new archetype
        const newTokens = components.filter(
          ([token]) => !oldArchetype.signature.has(token),
        );

        if (newTokens.length === 0) {
          // Just update values in place
          for (const [token, value] of components) {
            oldArchetype.columns.get(token)![oldRow] = value;
          }
          return ops;
        }

        // Need to move to new archetype
        const newSignature = new Set(oldArchetype.signature);
        for (const [token] of components) {
          newSignature.add(token);
        }

        // Collect current values
        const componentValues = new Map<Queryable, unknown>();
        for (const token of oldArchetype.signature) {
          componentValues.set(token, oldArchetype.columns.get(token)![oldRow]);
        }
        for (const [token, value] of components) {
          componentValues.set(token, value);
        }

        // Remove from old
        this.removeFromArchetype(record);

        // Add to new
        const newArchetype = this.getOrCreateArchetype(newSignature);
        const newRow = newArchetype.entities.length;
        newArchetype.entities.push(entityId);

        for (const token of newSignature) {
          newArchetype.columns.get(token)!.push(componentValues.get(token));
        }

        this.entityRecords[entityId] = { archetype: newArchetype, row: newRow };

        // Track additions for new components
        for (const [token] of newTokens) {
          if (!this.addedThisFrame.has(token)) {
            this.addedThisFrame.set(token, new Set());
          }
          this.addedThisFrame.get(token)!.add(entityId);
        }

        return ops;
      },

      remove: (...types: Queryable[]) => {
        if (!exists) return ops;

        const oldArchetype = record.archetype;
        const oldRow = record.row;

        // Check which types actually exist
        const typesToRemove = types.filter((t) =>
          oldArchetype.signature.has(t),
        );
        if (typesToRemove.length === 0) return ops;

        // Calculate new signature
        const newSignature = new Set(oldArchetype.signature);
        for (const type of typesToRemove) {
          newSignature.delete(type);
        }

        // Collect values for remaining components
        const componentValues = new Map<Queryable, unknown>();
        for (const token of newSignature) {
          componentValues.set(token, oldArchetype.columns.get(token)![oldRow]);
        }

        // Track removals
        for (const type of typesToRemove) {
          if (!this.removedThisFrame.has(type)) {
            this.removedThisFrame.set(type, new Set());
          }
          this.removedThisFrame.get(type)!.add(entityId);
        }

        // Remove from old
        this.removeFromArchetype(record);

        // Add to new (if any components remain)
        if (newSignature.size > 0) {
          const newArchetype = this.getOrCreateArchetype(newSignature);
          const newRow = newArchetype.entities.length;
          newArchetype.entities.push(entityId);

          for (const token of newSignature) {
            newArchetype.columns.get(token)!.push(componentValues.get(token));
          }

          this.entityRecords[entityId] = {
            archetype: newArchetype,
            row: newRow,
          };
        } else {
          this.entityRecords[entityId] = null;
        }

        return ops;
      },

      inspect: () => {
        if (!exists) return [];
        const values: unknown[] = [];
        for (const col of record.archetype.columns.values()) {
          values.push(col[record.row]);
        }
        return values;
      },

      despawn: () => {
        if (!exists) return;
        this.pendingDespawns.add(entityId);
      },
    };

    return ops;
  }

  private removeFromArchetype(record: EntityRecord): void {
    const { archetype, row } = record;
    const lastRow = archetype.entities.length - 1;

    if (row !== lastRow) {
      // Swap with last entity
      const lastEntity = archetype.entities[lastRow];
      archetype.entities[row] = lastEntity;

      for (const col of archetype.columns.values()) {
        col[row] = col[lastRow];
      }

      // Update swapped entity's record
      this.entityRecords[lastEntity]!.row = row;
    }

    // Pop last element
    archetype.entities.pop();
    for (const col of archetype.columns.values()) {
      col.pop();
    }
  }

  private processDespawns(): void {
    for (const entityId of this.pendingDespawns) {
      const record = this.entityRecords[entityId];
      if (!record) continue;

      // Track removals for all components
      for (const token of record.archetype.signature) {
        if (!this.removedThisFrame.has(token)) {
          this.removedThisFrame.set(token, new Set());
        }
        this.removedThisFrame.get(token)!.add(entityId);
      }

      this.removeFromArchetype(record);
      this.entityRecords[entityId] = null;
    }

    this.pendingDespawns.clear();
  }

  // ============================================================
  // Change tracking
  // ============================================================

  private advanceChangeTracking(): void {
    this.addedLastFrame = this.addedThisFrame;
    this.removedLastFrame = this.removedThisFrame;
    this.addedThisFrame = new Map();
    this.removedThisFrame = new Map();
  }

  // ============================================================
  // Resources
  // ============================================================

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

  // ============================================================
  // Events
  // ============================================================

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
