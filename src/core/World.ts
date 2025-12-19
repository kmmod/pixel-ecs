import { register, resource, TOKEN_ID, type RegistryToken } from "./Component";
import type {
  CachedQuery,
  ComponentTuple,
  Queryable,
  QueryResults,
} from "./Query";
import {
  PostUpdate,
  PreUpdate,
  Render,
  Startup,
  Update,
  type StageToken,
  type System,
} from "./Systems";

interface EntityOperations {
  insert: (...components: ComponentTuple[]) => EntityOperations;
  remove: (...types: Queryable[]) => EntityOperations;
  despawn: () => void;
}

type Entity = number;
export const Entity = register<number>();

export type ResourceToken<T> = RegistryToken<T>;

// Default Time resource
type Time = { delta: number; elapsed: number };
export const Time = resource<Time>({ delta: 0, elapsed: 0 });

export class World {
  private entityCounter = 0;
  private entities = new Map<number, Map<Queryable, unknown>>();
  private queryCache = new Map<string, CachedQuery<Queryable[]>>();
  private resources = new Map<RegistryToken<unknown>, unknown>();

  private systems = new Map<StageToken, System[]>();
  private running = false;
  private animationFrameId: number | null = null;

  // Systems
  // Stage execution order
  private readonly updateStages: StageToken[] = [
    PreUpdate,
    Update,
    PostUpdate,
    Render,
  ];

  // System registration
  public addSystem(stage: StageToken, system: System): this {
    const systems = this.systems.get(stage) ?? [];
    systems.push(system);
    this.systems.set(stage, systems);
    return this;
  }

  // Run systems for a specific stage
  private runStage(stage: StageToken): void {
    const systems = this.systems.get(stage) ?? [];
    for (const system of systems) {
      system(this);
    }
  }

  // Must be called first (maybe time should be inserted separately? or loop should be separate from world?)
  public init(): void {
    this.insertRes(Time());
    this.runStage(Startup);
  }

  public async initAsync(): Promise<void> {
    // For async startup systems in the future
    // Warmup rendering, download assets etc
  }

  public run(): void {
    this.running = true;

    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      if (!this.running) return;

      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Update Time resource
      const time = this.getRes(Time);
      if (time) {
        time.delta = delta;
        time.elapsed += delta;
      }

      for (const stage of this.updateStages) {
        this.runStage(stage);
      }
      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.running = false;
  }

  public resume(): void {
    if (!this.running) {
      this.running = true;
      this.run();
    }
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

    for (const [token, _] of components) {
      this.invalidateQueriesFor(token);
    }

    return this.entityCounter;
  }

  public entity(entity: number): EntityOperations {
    const componentMap = this.entities.get(entity);
    if (!componentMap) {
      console.warn(`Entity ${entity} does not exist.`);
    }

    const ops: EntityOperations = {
      insert: (...components: ComponentTuple[]) => {
        for (const [type, value] of components) {
          componentMap?.set(type, value);
          this.invalidateQueriesFor(type);
        }
        return ops;
      },
      remove: (...types: Queryable[]) => {
        for (const type of types) {
          componentMap?.delete(type);
          this.invalidateQueriesFor(type);
        }
        return ops;
      },
      despawn: () => {
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

  // TODO: Events!
  // // Event queue - holds events and tracks which have been read
  // class EventQueue<T> {
  //   private events: { data: T; frame: number }[] = [];
  //   private currentFrame = 0;
  //   private lastReadFrame = -1;
  //  ...
  //
  // // Event reader/writer interfaces for type-safe access
  // class EventWriter<T> {
  // class EventReader<T> {
}
