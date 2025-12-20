import {
  register,
  TOKEN_ID,
  type ComponentTuple,
  type EventToken,
  type RegistryToken,
  type ResourceToken,
} from "./Registry";
import { isWithout, type Queryable, type QueryResults } from "./Query";
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
  signature: Set<RegistryToken<unknown>>;
  columns: Map<RegistryToken<unknown>, unknown[]>;
  entities: number[];
};

type EntityRecord = {
  archetype: Archetype;
  row: number;
};

/**
 * Fluent interface for operating on a single entity.
 * Returned by {@link World.entity}.
 */
interface EntityOperations {
  /**
   * Get a component by its token (read-only access).
   * Does not mark the component as changed.
   */
  get: <C>(token: RegistryToken<C>) => C | undefined;

  /**
   * Get a component by its token with mutable access.
   * Marks the component as changed for {@link World.queryChanged}.
   */
  getMut: <C>(token: RegistryToken<C>) => C | undefined;
  /**
   * Check if the entity has all specified component types.
   */
  has: (...types: RegistryToken<unknown>[]) => boolean;
  /**
   * Insert components into the entity.
   */
  insert: (...components: ComponentTuple[]) => void;
  /**
   * Remove components from the entity by their tokens.
   */
  remove: (...types: RegistryToken<unknown>[]) => void;
  inspect: () => unknown[];

  /**
   * Mark the entity for removal at end of frame.
   */
  despawn: () => void;
}

/**
 * The World is the central data structure of the ECS.
 * It stores all entities, components, resources, and systems.
 *
 * @example
 * ```ts
 * const world = new World();
 *
 * // Register systems
 * world.addSystem(Update, movementSystem);
 * world.addSystem(Render, renderSystem);
 *
 * // Spawn entities
 * world.spawn(Position(0, 0), Velocity(1, 1));
 *
 * // Run the world
 * world.init();
 * world.update(); // call each frame
 * ```
 */
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
  private mutatedThisFrame = new Map<Queryable, Set<number>>();
  private mutatedLastFrame = new Map<Queryable, Set<number>>();

  // Deferred operations
  private pendingDespawns = new Set<number>();

  // ============================================================
  // Archetype helpers
  // ============================================================

  private getSignatureKey(types: Iterable<RegistryToken<unknown>>): string {
    return [...types]
      .map((t) => t[TOKEN_ID])
      .sort((a, b) => a - b)
      .join(":");
  }

  private getOrCreateArchetype(
    signature: Set<RegistryToken<unknown>>,
  ): Archetype {
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
  /**
   * Pre-register an archetype for a specific combination of component types.
   * This can improve performance by avoiding archetype creation during gameplay.
   *
   * @param tokens - Component tokens that define the archetype signature
   * @returns `this` for chaining
   *
   * @example
   * ```ts
   * // Pre-warm common archetypes at startup
   * world
   *   .registerArchetype(Position, Velocity)
   *   .registerArchetype(Position, Velocity, Sprite)
   *   .registerArchetype(Position, Collider);
   * ```
   */
  public registerArchetype(...tokens: RegistryToken<unknown>[]): this {
    this.getOrCreateArchetype(new Set(tokens));
    return this;
  }

  // ============================================================
  // Mutation tracking
  // ============================================================

  private markMutated(entityId: number, token: RegistryToken<unknown>): void {
    let set = this.mutatedThisFrame.get(token);
    if (!set) {
      set = new Set();
      this.mutatedThisFrame.set(token, set);
    }
    set.add(entityId);
  }

  // ============================================================
  // State management
  // ============================================================

  /**
   * Register a state machine with its initial value.
   * States can be used to control system execution via {@link OnEnter} and {@link OnExit} stages.
   *
   * @param token - State token created with `state()`, must include `initial` value
   * @returns `this` for chaining
   *
   * @example
   * ```ts
   * const GameState = state<"menu" | "playing" | "paused">("menu");
   *
   * world.insertState(GameState);
   *
   * // Systems that run on state transitions
   * world.addSystem(OnEnter(GameState("playing")), startGameSystem);
   * world.addSystem(OnExit(GameState("playing")), cleanupGameSystem);
   * ```
   */
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

  /**
   * Transition a state machine to a new value.
   * This triggers {@link OnExit} systems for the old state and {@link OnEnter} systems
   * for the new state during the next {@link update} call.
   *
   * @param stateValue - State value created by calling the state token as a function
   *
   * @example
   * ```ts
   * // Transition to playing state
   * world.setState(GameState("playing"));
   *
   * // Later, pause the game
   * world.setState(GameState("paused"));
   * ```
   */
  public setState<T extends string>(stateValue: StateValue<T>): void {
    const entry = this.states.get(stateValue.state);
    if (!entry || entry.current === stateValue.value) return;

    entry.previous = entry.current;
    entry.current = stateValue.value;
    entry.dirty = true;
  }

  /**
   * Get the current value of a state machine.
   *
   * @param token - State token to query
   * @returns Current state value, or `undefined` if state not registered
   *
   * @example
   * ```ts
   * const currentState = world.getState(GameState);
   * if (currentState === "paused") {
   *   // Handle paused state
   * }
   * ```
   */
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

  /**
   * Register a system to run during a specific stage.
   * Systems are functions that operate on the world, typically querying
   * and modifying entities and components.
   *
   * @param stage - Stage token (e.g., `Startup`, `Update`, `Render`)
   * @param system - System function or array of system functions
   * @param options - Optional configuration
   * @param options.when - Array of condition functions; system only runs if all return `true`
   * @returns `this` for chaining
   *
   * @example
   * ```ts
   * // Basic system registration
   * world.addSystem(Update, movementSystem);
   *
   * // Multiple systems at once
   * world.addSystem(Update, [physicsSystem, collisionSystem]);
   *
   * // Conditional system (only runs when game is not paused)
   * world.addSystem(Update, aiSystem, {
   *   when: [(world) => world.getState(GameState) === "playing"]
   * });
   * ```
   */
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

  /**
   * Initialize the world by running all {@link Startup} systems.
   * Call this once before the game loop begins.
   *
   * @example
   * ```ts
   * world.addSystem(Startup, loadAssetsSystem);
   * world.addSystem(Startup, spawnPlayerSystem);
   *
   * world.init(); // Runs startup systems once
   *
   * // Game loop
   * function loop() {
   *   world.update();
   *   requestAnimationFrame(loop);
   * }
   * ```
   */
  public init(): void {
    this.runStage(Startup);
  }

  /**
   * Async version of {@link init} for systems that need to await resources.
   * Currently a placeholder for future async startup system support.
   */
  public async initAsync(): Promise<void> {
    // For async startup systems in the future
  }

  /**
   * Run one frame of the world simulation.
   * Executes systems in order: PreUpdate → State Transitions → Update → PostUpdate → Render.
   * Also processes deferred despawns and advances change tracking.
   *
   * Call this once per frame in your game loop.
   *
   * @example
   * ```ts
   * // Typical game loop
   * function gameLoop() {
   *   world.update();
   *   requestAnimationFrame(gameLoop);
   * }
   *
   * // Or with fixed timestep
   * setInterval(() => world.update(), 1000 / 60);
   * ```
   */
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
    const required: RegistryToken<unknown>[] = [];
    const excluded: number[] = [];

    for (const t of types) {
      if (t === Entity) continue;
      if (isWithout(t)) {
        excluded.push(t[TOKEN_ID]);
      } else {
        required.push(t as RegistryToken<unknown>);
      }
    }

    const key =
      this.getSignatureKey(required) +
      (excluded.length > 0 ? "|!" + excluded.sort().join(":") : "");
    let cached = this.queryCache.get(key);

    if (!cached) {
      cached = [];

      for (const archetype of this.archetypes.values()) {
        const hasRequired = required.every((t) => archetype.signature.has(t));
        if (!hasRequired) continue;

        const hasExcluded = excluded.some((id) =>
          [...archetype.signature].some((t) => t[TOKEN_ID] === id),
        );
        if (hasExcluded) continue;

        cached.push(archetype);
      }
      this.queryCache.set(key, cached);
    }

    return cached;
  }

  /**
   * Query for entities with specified components.
   * Use Without(Component) to exclude entities.
   *
   * @example
   * ```ts
   * // Basic query
   * for (const [pos, vel] of world.query(Position, Velocity)) {}
   *
   * // With entity ID
   * for (const [entity, pos] of world.query(Entity, Position)) {}
   *
   * // Exclude enemies
   * for (const [entity, pos] of world.query(Entity, Position, Without(Enemy))) {}
   * ```
   */
  public query<T extends Queryable[]>(...types: T): QueryResults<T>[] {
    const archetypes = this.getMatchingArchetypes(types);
    const results: QueryResults<T>[] = [];
    const outputTypes = types.filter((t) => !isWithout(t));

    for (const archetype of archetypes) {
      const len = archetype.entities.length;
      const columns = outputTypes.map((t) =>
        t === Entity
          ? archetype.entities
          : archetype.columns.get(t as RegistryToken<unknown>)!,
      );

      for (let row = 0; row < len; row++) {
        const tuple = columns.map((col) => col[row]) as QueryResults<T>;
        results.push(tuple);
      }
    }

    return results;
  }

  /**
   * Query for all entities with the specified components, marking them as mutated.
   * Use this when you intend to modify the returned components.
   *
   * Components accessed via `queryMut` will appear in {@link queryChanged} results
   * on the next frame.
   *
   * @param types - Component tokens to query for
   * @returns Array of tuples, each containing the queried components in order
   *
   * @example
   * ```ts
   * // Movement system - modifies Position based on Velocity
   * const movementSystem = (world: World) => {
   *   const time = world.getResource(Time)!;
   *
   *   for (const [pos, vel] of world.queryMut(Position, Velocity)) {
   *     pos.x += vel.x * time.delta;
   *     pos.y += vel.y * time.delta;
   *   }
   * };
   *
   * // Later, react to position changes
   * const spatialUpdateSystem = (world: World) => {
   *   for (const [entity, pos] of world.queryChanged(Entity, Position)) {
   *     updateSpatialIndex(entity, pos);
   *   }
   * };
   * ```
   */
  public queryMut<T extends Queryable[]>(...types: T): QueryResults<T>[] {
    const archetypes = this.getMatchingArchetypes(types);
    const results: QueryResults<T>[] = [];
    const componentTypes = types.filter(
      (t) => t !== Entity && !isWithout(t),
    ) as RegistryToken<unknown>[];
    const outputTypes = types.filter((t) => !isWithout(t));

    for (const archetype of archetypes) {
      const len = archetype.entities.length;
      const columns = outputTypes.map((t) =>
        t === Entity
          ? archetype.entities
          : archetype.columns.get(t as RegistryToken<unknown>)!,
      );

      for (let row = 0; row < len; row++) {
        const entityId = archetype.entities[row];

        for (const token of componentTypes) {
          this.markMutated(entityId, token);
        }

        const tuple = columns.map((col) => col[row]) as QueryResults<T>;
        results.push(tuple);
      }
    }

    return results;
  }

  /**
   * Query for entities that had any of the specified components added last frame.
   * Useful for initialization logic when components are first attached.
   *
   * @param types - Component tokens to query for
   * @returns Array of tuples for entities with newly added components
   *
   * @example
   * ```ts
   * // Initialize physics bodies when Collider is added
   * const initPhysicsSystem = (world: World) => {
   *   for (const [entity, collider, pos] of world.queryAdded(Entity, Collider, Position)) {
   *     collider.body = physicsWorld.createBody(pos.x, pos.y);
   *   }
   * };
   * ```
   */
  public queryAdded<T extends Queryable[]>(...types: T): QueryResults<T>[] {
    const componentTypes = types.filter(
      (t) => t !== Entity && !isWithout(t),
    ) as RegistryToken<unknown>[];
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

    return this.query(...types).filter((tuple) =>
      addedEntities.has(tuple[0] as number),
    );
  }

  /**
   * Query for entities where any of the specified components were accessed
   * mutably (via {@link queryMut} or {@link EntityOperations.getMut}) last frame.
   *
   * **Note:** This tracks mutable *access*, not actual value changes.
   * There may be false positives if you get a mutable reference but don't
   * actually modify the component.
   *
   * @param types - Component tokens to query for
   * @returns Array of tuples for entities with potentially changed components
   *
   * @example
   * ```ts
   * // Update spatial index when positions change
   * const updateSpatialIndexSystem = (world: World) => {
   *   for (const [entity, pos] of world.queryChanged(Entity, Position)) {
   *     spatialIndex.update(entity, pos.x, pos.y);
   *   }
   * };
   *
   * // Recalculate bounding boxes when transforms change
   * const updateBoundsSystem = (world: World) => {
   *   for (const [entity, transform, bounds] of world.queryChanged(Entity, Transform, Bounds)) {
   *     bounds.recalculate(transform);
   *   }
   * };
   * ```
   */
  public queryChanged<T extends Queryable[]>(...types: T): QueryResults<T>[] {
    const componentTypes = types.filter(
      (t) => t !== Entity && !isWithout(t),
    ) as RegistryToken<unknown>[];
    if (componentTypes.length === 0) return [];

    // Collect all entities that had ANY of the queried components mutated
    const changedEntities = new Set<number>();
    for (const type of componentTypes) {
      const mutated = this.mutatedLastFrame.get(type);
      if (mutated) {
        for (const entity of mutated) {
          changedEntities.add(entity);
        }
      }
    }

    if (changedEntities.size === 0) return [];

    return this.query(...types).filter((tuple) =>
      changedEntities.has(tuple[0] as number),
    );
  }
  /**
   * Get entity IDs that had any of the specified components removed last frame.
   * Useful for cleanup logic when components are detached.
   *
   * **Note:** Only returns entity IDs since the components no longer exist.
   *
   * @param types - Component tokens to check for removal
   * @returns Array of entity IDs that had components removed
   *
   * @example
   * ```ts
   * // Clean up physics bodies when Collider is removed
   * const cleanupPhysicsSystem = (world: World) => {
   *   for (const entityId of world.queryRemoved(Collider)) {
   *     const body = physicsBodyMap.get(entityId);
   *     if (body) {
   *       physicsWorld.destroyBody(body);
   *       physicsBodyMap.delete(entityId);
   *     }
   *   }
   * };
   * ```
   */
  public queryRemoved(...types: RegistryToken<unknown>[]): number[] {
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

  /**
   * Create a new entity with the specified components.
   *
   * @param components - Component tuples created by calling component factories
   * @returns The new entity's ID
   *
   * @example
   * ```ts
   * // Spawn an entity with multiple components
   * const player = world.spawn(
   *   Position(0, 0),
   *   Velocity(0, 0),
   *   Health(100),
   *   Player()
   * );
   *
   * // Spawn a simple entity
   * const bullet = world.spawn(
   *   Position(x, y),
   *   Velocity(Math.cos(angle) * speed, Math.sin(angle) * speed),
   *   Damage(10)
   * );
   * ```
   */
  public spawn(...components: ComponentTuple[]): number {
    const entity = ++this.entityCounter;
    const signature = new Set<RegistryToken<unknown>>(
      components.map(([token]) => token),
    );
    const archetype = this.getOrCreateArchetype(signature);

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
    return entity;
  }

  /**
   * Spawn multiple entities efficiently using a factory function.
   * All entities will share the same archetype, which is more efficient
   * than calling {@link spawn} in a loop.
   *
   * @param count - Number of entities to spawn
   * @param factory - Function that returns component tuples for each entity
   * @returns Array of new entity IDs
   *
   * @example
   * ```ts
   * // Spawn 1000 particles with random positions
   * const particles = world.spawnBatch(1000, () => [
   *   Position(Math.random() * 800, Math.random() * 600),
   *   Velocity((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10),
   *   Lifetime(Math.random() * 2 + 1)
   * ]);
   *
   * // Spawn enemies in a grid formation
   * let gridIndex = 0;
   * const enemies = world.spawnBatch(25, () => {
   *   const x = (gridIndex % 5) * 50;
   *   const y = Math.floor(gridIndex / 5) * 50;
   *   gridIndex++;
   *   return [Position(x, y), Enemy(), Health(50)];
   * });
   * ```
   */
  public spawnBatch(count: number, factory: () => ComponentTuple[]): number[] {
    const entities: number[] = [];

    // Get archetype once from first entity's components
    const templateComponents = factory();
    const signature = new Set<RegistryToken<unknown>>(
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

  /**
   * Get a fluent interface for operating on a single entity.
   * Allows getting, setting, and removing components on the entity.
   *
   * Operations are safe to call on non-existent entities (they no-op).
   *
   * @param entityId - The entity ID to operate on
   * @returns An {@link EntityOperations} interface for the entity
   *
   * @example
   * ```ts
   * // Get a component (read-only)
   * const pos = world.entity(playerId).get(Position);
   *
   * // Get a component for mutation (marks as changed)
   * const vel = world.entity(playerId).getMut(Velocity);
   * if (vel) {
   *   vel.x = 0;
   *   vel.y = 0;
   * }
   *
   * // Check if entity has components
   * if (world.entity(id).has(Enemy, Health)) {
   *   // It's a living enemy
   * }
   *
   * // Add components to existing entity
   * world.entity(playerId)
   *   .insert(Invincible())
   *   .insert(PowerUp("speed"));
   *
   * // Remove components
   * world.entity(playerId).remove(Invincible);
   *
   * // Despawn entity (deferred until end of frame)
   * world.entity(bulletId).despawn();
   * ```
   */
  public entity(entityId: number): EntityOperations {
    const record = this.entityRecords[entityId];
    const exists = !!record;

    const ops: EntityOperations = {
      get: <C>(token: RegistryToken<C>): C | undefined => {
        if (!exists) return undefined;
        const col = record.archetype.columns.get(token);
        return col?.[record.row] as C | undefined;
      },

      getMut: <C>(token: RegistryToken<C>): C | undefined => {
        if (!exists) return undefined;
        const col = record.archetype.columns.get(token);
        if (!col) return undefined;

        // Mark as mutated
        this.markMutated(entityId, token);
        return col[record.row] as C | undefined;
      },

      has: (...types: RegistryToken<unknown>[]): boolean => {
        if (!exists) return false;
        return types.every((t) => record.archetype.signature.has(t));
      },

      insert: (...components: ComponentTuple[]): void => {
        if (!exists) return;

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
            // Mark as mutated since we're updating
            this.markMutated(entityId, token);
          }
          return;
        }

        // Need to move to new archetype
        const newSignature = new Set(oldArchetype.signature);
        for (const [token] of components) {
          newSignature.add(token);
        }

        const componentValues = new Map<RegistryToken<unknown>, unknown>();
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
      },

      remove: (...types: RegistryToken<unknown>[]): void => {
        if (!exists) return;

        const oldArchetype = record.archetype;
        const oldRow = record.row;

        const typesToRemove = types.filter((t) =>
          oldArchetype.signature.has(t),
        );
        if (typesToRemove.length === 0) return;

        const newSignature = new Set(oldArchetype.signature);
        for (const type of typesToRemove) {
          newSignature.delete(type);
        }

        const componentValues = new Map<RegistryToken<unknown>, unknown>();
        for (const token of newSignature) {
          componentValues.set(token, oldArchetype.columns.get(token)![oldRow]);
        }

        for (const type of typesToRemove) {
          if (!this.removedThisFrame.has(type)) {
            this.removedThisFrame.set(type, new Set());
          }
          this.removedThisFrame.get(type)!.add(entityId);
        }

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
    this.mutatedLastFrame = this.mutatedThisFrame;

    this.addedThisFrame = new Map();
    this.removedThisFrame = new Map();
    this.mutatedThisFrame = new Map();
  }

  // ============================================================
  // Resources
  // ============================================================

  /**
   * Insert one or more global resources into the world.
   * Resources are singleton data accessible from any system.
   *
   * @param resources - Resource tuples created by calling resource factories
   * @returns `this` for chaining
   *
   * @example
   * ```ts
   * // Define resources
   * const Time = resource(() => ({ delta: 0, elapsed: 0 }));
   * const Input = resource(() => ({ keys: new Set<string>() }));
   * const Config = resource((difficulty: number) => ({ difficulty }));
   *
   * // Insert resources
   * world
   *   .insertResource(Time())
   *   .insertResource(Input())
   *   .insertResource(Config(2));
   * ```
   */
  public insertResource<T>(...resources: [ResourceToken<T>, T][]): this {
    for (const [token, value] of resources) {
      this.resources.set(token, value);
    }
    return this;
  }

  /**
   * Get a resource by its token.
   *
   * @param token - Resource token to retrieve
   * @returns The resource value, or `undefined` if not inserted
   *
   * @example
   * ```ts
   * const movementSystem = (world: World) => {
   *   const time = world.getResource(Time);
   *   if (!time) return;
   *
   *   for (const [pos, vel] of world.queryMut(Position, Velocity)) {
   *     pos.x += vel.x * time.delta;
   *     pos.y += vel.y * time.delta;
   *   }
   * };
   * ```
   */
  public getResource<T>(token: ResourceToken<T>): T | undefined {
    return this.resources.get(token) as T | undefined;
  }

  /**
   * Remove a resource from the world.
   *
   * @param token - Resource token to remove
   * @returns `true` if the resource existed and was removed, `false` otherwise
   *
   * @example
   * ```ts
   * // Remove a temporary resource
   * world.removeResource(LoadingScreen);
   * ```
   */
  public removeResource<T>(token: ResourceToken<T>): boolean {
    return this.resources.delete(token);
  }

  // ============================================================
  // Events
  // ============================================================

  /**
   * Get a writer for sending events of a specific type.
   * Events are a way for systems to communicate without tight coupling.
   *
   * Events persist for one frame after being sent, allowing multiple
   * systems to read them.
   *
   * @param token - Event token created with `event()`
   * @returns An {@link EventWriter} for sending events
   *
   * @example
   * ```ts
   * // Define an event
   * const DamageEvent = event<{ target: number; amount: number }>();
   *
   * // Send events from a system
   * const combatSystem = (world: World) => {
   *   const writer = world.getEventWriter(DamageEvent);
   *
   *   for (const [entity, attack] of world.query(Entity, Attack)) {
   *     writer.send({ target: attack.target, amount: attack.damage });
   *   }
   * };
   * ```
   */
  public getEventWriter<T>(token: EventToken<T>): EventWriter<T> {
    let queue = this.eventQueues.get(token) as EventQueue<T> | undefined;
    if (!queue) {
      queue = new EventQueue<T>();
      this.eventQueues.set(token, queue);
    }
    return new EventWriter(queue);
  }

  /**
   * Get a reader for receiving events of a specific type.
   * Events are available for one frame after being sent.
   *
   * @param token - Event token created with `event()`
   * @returns An {@link EventReader} for reading events
   *
   * @example
   * ```ts
   * // Read events in another system
   * const healthSystem = (world: World) => {
   *   const reader = world.getEventReader(DamageEvent);
   *
   *   for (const event of reader.read()) {
   *     const health = world.entity(event.target).getMut(Health);
   *     if (health) {
   *       health.current -= event.amount;
   *     }
   *   }
   * };
   * ```
   */
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
