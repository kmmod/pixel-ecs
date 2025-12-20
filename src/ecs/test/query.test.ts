import { describe, it, expect, beforeEach } from "vitest";
import { World, Entity } from "@ecs/World";
import { component } from "@ecs/Registry";
import { Without } from "@ecs/Query";

const Position = component((x: number, y: number) => ({ x, y }));
const Velocity = component((x: number, y: number) => ({ x, y }));
const Health = component((current: number) => ({ current }));
const Enemy = component(() => ({}));
const Frozen = component(() => ({}));

describe("World.query", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("returns empty array when no entities exist", () => {
    expect(world.query(Position)).toEqual([]);
  });

  it("queries single component", () => {
    world.spawn(Position(10, 20));

    const results = world.query(Position);

    expect(results).toHaveLength(1);
    expect(results[0][0]).toEqual({ x: 10, y: 20 });
  });

  it("queries multiple components", () => {
    world.spawn(Position(1, 2), Velocity(3, 4));

    const results = world.query(Position, Velocity);

    expect(results).toHaveLength(1);
    expect(results[0][0]).toEqual({ x: 1, y: 2 });
    expect(results[0][1]).toEqual({ x: 3, y: 4 });
  });

  it("includes Entity token to get entity ID", () => {
    const id = world.spawn(Position(5, 5));

    const results = world.query(Entity, Position);

    expect(results[0][0]).toBe(id);
    expect(results[0][1]).toEqual({ x: 5, y: 5 });
  });

  it("filters entities missing required components", () => {
    world.spawn(Position(1, 1));
    world.spawn(Position(2, 2), Velocity(1, 1));
    world.spawn(Velocity(3, 3));

    const results = world.query(Position, Velocity);

    expect(results).toHaveLength(1);
    expect(results[0][0]).toEqual({ x: 2, y: 2 });
  });

  it("returns references to actual components (mutable)", () => {
    world.spawn(Position(0, 0));

    const [[pos]] = world.query(Position);
    pos.x = 999;

    const [[updated]] = world.query(Position);
    expect(updated.x).toBe(999);
  });
});

describe("World.queryMut", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("returns same results as query", () => {
    world.spawn(Position(1, 2), Velocity(3, 4));

    const queryResults = world.query(Position, Velocity);
    const mutResults = world.queryMut(Position, Velocity);

    expect(mutResults).toEqual(queryResults);
  });

  it("marks components as changed for queryChanged", () => {
    world.spawn(Position(0, 0));

    world.queryMut(Position); // access mutably
    world.update(); // advance frame

    const changed = world.queryChanged(Entity, Position);
    expect(changed).toHaveLength(1);
  });

  it("query does not mark as changed", () => {
    world.spawn(Position(0, 0));

    world.query(Position); // read-only access
    world.update();

    const changed = world.queryChanged(Entity, Position);
    expect(changed).toHaveLength(0);
  });
});

describe("World.queryAdded", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("detects newly spawned entities", () => {
    world.spawn(Position(1, 1));
    world.update(); // advance to make "this frame" become "last frame"

    const added = world.queryAdded(Entity, Position);
    expect(added).toHaveLength(1);
  });

  it("clears after one frame", () => {
    world.spawn(Position(1, 1));
    world.update();
    world.update(); // second frame

    const added = world.queryAdded(Entity, Position);
    expect(added).toHaveLength(0);
  });

  it("detects components added via insert", () => {
    const id = world.spawn(Position(0, 0));
    world.update();

    world.entity(id).insert(Velocity(1, 1));
    world.update();

    const added = world.queryAdded(Entity, Velocity);
    expect(added).toHaveLength(1);
    expect(added[0][0]).toBe(id);
  });
});

describe("World.queryChanged", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("detects getMut access", () => {
    const id = world.spawn(Position(0, 0));
    world.update(); // clear added state

    world.entity(id).getMut(Position);
    world.update();

    const changed = world.queryChanged(Entity, Position);
    expect(changed).toHaveLength(1);
  });

  it("detects queryMut access", () => {
    world.spawn(Position(0, 0));
    world.update(); // clear added state

    world.queryMut(Position);
    world.update();
    const changed = world.queryChanged(Entity, Position);
    expect(changed).toHaveLength(1);
  });

  it("detects insert updates on existing components", () => {
    const id = world.spawn(Position(0, 0));
    world.update();

    world.entity(id).insert(Position(99, 99));
    world.update();

    const changed = world.queryChanged(Entity, Position);
    expect(changed).toHaveLength(1);
  });

  it("clears after one frame", () => {
    const id = world.spawn(Position(0, 0));
    world.update();

    world.entity(id).getMut(Position);
    world.update();
    world.update(); // second frame

    const changed = world.queryChanged(Entity, Position);
    expect(changed).toHaveLength(0);
  });
});

describe("World.queryRemoved", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("detects removed components", () => {
    const id = world.spawn(Position(0, 0), Velocity(1, 1));
    world.update();

    world.entity(id).remove(Velocity);
    world.update();

    const removed = world.queryRemoved(Velocity);
    expect(removed).toContain(id);
  });

  it("detects despawned entities", () => {
    const id = world.spawn(Position(0, 0));
    world.update();

    world.entity(id).despawn();
    world.update();

    const removed = world.queryRemoved(Position);
    expect(removed).toContain(id);
  });

  it("clears after one frame", () => {
    const id = world.spawn(Position(0, 0));
    world.update();

    world.entity(id).despawn();
    world.update();
    world.update();

    const removed = world.queryRemoved(Position);
    expect(removed).not.toContain(id);
  });
});

describe("World.registerArchetype", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("pre-registers archetype", () => {
    world.registerArchetype(Position, Velocity);

    // Spawning with same signature should reuse archetype
    const id = world.spawn(Position(1, 1), Velocity(2, 2));

    expect(world.entity(id).has(Position, Velocity)).toBe(true);
  });

  it("chains multiple registrations", () => {
    world
      .registerArchetype(Position)
      .registerArchetype(Position, Velocity)
      .registerArchetype(Position, Velocity, Health);

    const id = world.spawn(Position(0, 0), Velocity(1, 1), Health(100));

    expect(world.entity(id).has(Position, Velocity, Health)).toBe(true);
  });

  it("does not duplicate existing archetypes", () => {
    world.registerArchetype(Position, Velocity);
    world.registerArchetype(Position, Velocity); // same signature

    world.spawn(Position(1, 1), Velocity(2, 2));

    expect(world.query(Entity, Position, Velocity)).toHaveLength(1);
  });
});

describe("Without filter", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("excludes entities with specified component", () => {
    world.spawn(Position(0, 0));
    world.spawn(Position(1, 1), Enemy());
    world.spawn(Position(2, 2));

    const results = world.query(Entity, Position, Without(Enemy));

    expect(results).toHaveLength(2);
    expect(results.map(([_, pos]) => pos.x)).toEqual([0, 2]);
  });

  it("works with multiple Without filters", () => {
    world.spawn(Position(0, 0));
    world.spawn(Position(1, 1), Enemy());
    world.spawn(Position(2, 2), Frozen());
    world.spawn(Position(3, 3), Enemy(), Frozen());

    const results = world.query(
      Entity,
      Position,
      Without(Enemy),
      Without(Frozen),
    );

    expect(results).toHaveLength(1);
    expect(results[0][1].x).toBe(0);
  });

  it("returns all entities when excluded component not present", () => {
    world.spawn(Position(0, 0));
    world.spawn(Position(1, 1));

    const results = world.query(Position, Without(Enemy));

    expect(results).toHaveLength(2);
  });

  it("returns empty when all entities have excluded component", () => {
    world.spawn(Position(0, 0), Enemy());
    world.spawn(Position(1, 1), Enemy());

    const results = world.query(Position, Without(Enemy));

    expect(results).toHaveLength(0);
  });

  it("works with queryMut", () => {
    world.spawn(Position(0, 0));
    world.spawn(Position(1, 1), Frozen());

    const results = world.queryMut(Position, Without(Frozen));

    expect(results).toHaveLength(1);
    results[0][0].x = 99;

    // Verify mutation worked
    const [[pos]] = world.query(Position, Without(Frozen));
    expect(pos.x).toBe(99);
  });

  it("does not include Without component in result tuple", () => {
    world.spawn(Position(5, 5), Velocity(1, 1));

    const results = world.query(Entity, Position, Without(Enemy));

    // Should be [entity, position], not [entity, position, undefined]
    expect(results[0]).toHaveLength(2);
  });

  it("caches queries with Without filters", () => {
    world.spawn(Position(0, 0));
    world.spawn(Position(1, 1), Enemy());

    // Run same query twice
    const results1 = world.query(Position, Without(Enemy));
    const results2 = world.query(Position, Without(Enemy));

    expect(results1).toHaveLength(1);
    expect(results2).toHaveLength(1);
    expect(results1).toEqual(results2);
  });
});
