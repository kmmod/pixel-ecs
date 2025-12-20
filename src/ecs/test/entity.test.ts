import { describe, it, expect, beforeEach } from "vitest";
import { World, Entity } from "../../ecs/World";
import { component } from "../../ecs/Registry";

const Position = component((x: number, y: number) => ({ x, y }));
const Velocity = component((x: number, y: number) => ({ x, y }));
const Health = component((current: number) => ({ current }));

describe("World.spawn", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("returns unique entity ID", () => {
    const a = world.spawn(Position(0, 0));
    const b = world.spawn(Position(0, 0));
    const c = world.spawn(Position(0, 0));

    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
  });

  it("spawns entity with components", () => {
    const id = world.spawn(Position(1, 2), Velocity(3, 4));

    expect(world.entity(id).get(Position)).toEqual({ x: 1, y: 2 });
    expect(world.entity(id).get(Velocity)).toEqual({ x: 3, y: 4 });
  });

  it("spawns entity with no components", () => {
    const id = world.spawn();

    expect(world.entity(id).inspect()).toEqual([]);
  });
});

describe("World.spawnBatch", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("spawns multiple entities", () => {
    const ids = world.spawnBatch(5, () => [Position(0, 0)]);

    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5); // all unique
  });

  it("calls factory for each entity", () => {
    let counter = 0;
    const ids = world.spawnBatch(3, () => [Position(counter++, 0)]);

    expect(world.entity(ids[0]).get(Position)!.x).toBe(0);
    expect(world.entity(ids[1]).get(Position)!.x).toBe(1);
    expect(world.entity(ids[2]).get(Position)!.x).toBe(2);
  });
});

describe("EntityOperations.get", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("returns component value", () => {
    const id = world.spawn(Position(5, 10));

    expect(world.entity(id).get(Position)).toEqual({ x: 5, y: 10 });
  });

  it("returns undefined for missing component", () => {
    const id = world.spawn(Position(0, 0));

    expect(world.entity(id).get(Velocity)).toBeUndefined();
  });

  it("returns undefined for non-existent entity", () => {
    expect(world.entity(9999).get(Position)).toBeUndefined();
  });
});

describe("EntityOperations.getMut", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("returns mutable reference", () => {
    const id = world.spawn(Position(0, 0));

    const pos = world.entity(id).getMut(Position)!;
    pos.x = 100;

    expect(world.entity(id).get(Position)!.x).toBe(100);
  });

  it("marks component as changed", () => {
    const id = world.spawn(Position(0, 0));
    world.update(); // clear added

    world.entity(id).getMut(Position);
    world.update();

    const changed = world.queryChanged(Entity, Position);
    expect(changed.some(([e]) => e === id)).toBe(true);
  });

  it("returns undefined for missing component", () => {
    const id = world.spawn(Position(0, 0));

    expect(world.entity(id).getMut(Velocity)).toBeUndefined();
  });
});

describe("EntityOperations.has", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("returns true when entity has component", () => {
    const id = world.spawn(Position(0, 0), Velocity(1, 1));

    expect(world.entity(id).has(Position)).toBe(true);
    expect(world.entity(id).has(Velocity)).toBe(true);
  });

  it("returns true when entity has all components", () => {
    const id = world.spawn(Position(0, 0), Velocity(1, 1));

    expect(world.entity(id).has(Position, Velocity)).toBe(true);
  });

  it("returns false when missing any component", () => {
    const id = world.spawn(Position(0, 0));

    expect(world.entity(id).has(Velocity)).toBe(false);
    expect(world.entity(id).has(Position, Velocity)).toBe(false);
  });

  it("returns false for non-existent entity", () => {
    expect(world.entity(9999).has(Position)).toBe(false);
  });
});

describe("EntityOperations.insert", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("adds new component", () => {
    const id = world.spawn(Position(0, 0));

    world.entity(id).insert(Velocity(5, 5));

    expect(world.entity(id).get(Velocity)).toEqual({ x: 5, y: 5 });
  });

  it("updates existing component", () => {
    const id = world.spawn(Position(0, 0));

    world.entity(id).insert(Position(99, 99));

    expect(world.entity(id).get(Position)).toEqual({ x: 99, y: 99 });
  });

  it("chains multiple inserts", () => {
    const id = world.spawn(Position(0, 0));

    world.entity(id).insert(Velocity(1, 1), Health(100));

    expect(world.entity(id).has(Position, Velocity, Health)).toBe(true);
  });

  it("marks new components as added", () => {
    const id = world.spawn(Position(0, 0));
    world.update();

    world.entity(id).insert(Velocity(1, 1));
    world.update();

    const added = world.queryAdded(Entity, Velocity);
    expect(added.some(([e]) => e === id)).toBe(true);
  });

  it("marks updated components as changed", () => {
    const id = world.spawn(Position(0, 0));
    world.update();

    world.entity(id).insert(Position(1, 1));
    world.update();

    const changed = world.queryChanged(Entity, Position);
    expect(changed.some(([e]) => e === id)).toBe(true);
  });

  it("preserves other components when adding", () => {
    const id = world.spawn(Position(1, 2), Health(50));

    world.entity(id).insert(Velocity(3, 4));

    expect(world.entity(id).get(Position)).toEqual({ x: 1, y: 2 });
    expect(world.entity(id).get(Health)).toEqual({ current: 50 });
  });
});

describe("EntityOperations.remove", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("removes component", () => {
    const id = world.spawn(Position(0, 0), Velocity(1, 1));

    world.entity(id).remove(Velocity);

    expect(world.entity(id).has(Velocity)).toBe(false);
    expect(world.entity(id).has(Position)).toBe(true);
  });

  it("chains multiple removes", () => {
    const id = world.spawn(Position(0, 0), Velocity(1, 1), Health(100));

    world.entity(id).remove(Velocity, Health);

    expect(world.entity(id).has(Position)).toBe(true);
    expect(world.entity(id).has(Velocity)).toBe(false);
    expect(world.entity(id).has(Health)).toBe(false);
  });

  it("marks removed components for queryRemoved", () => {
    const id = world.spawn(Position(0, 0), Velocity(1, 1));
    world.update();

    world.entity(id).remove(Velocity);
    world.update();

    expect(world.queryRemoved(Velocity)).toContain(id);
  });

  it("no-ops when removing missing component", () => {
    const id = world.spawn(Position(0, 0));

    world.entity(id).remove(Velocity); // should not throw

    expect(world.entity(id).has(Position)).toBe(true);
  });
});

describe("EntityOperations.despawn", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("removes entity after update", () => {
    const id = world.spawn(Position(0, 0));

    world.entity(id).despawn();
    world.update();

    expect(world.entity(id).get(Position)).toBeUndefined();
  });

  it("entity still accessible until update", () => {
    const id = world.spawn(Position(5, 5));

    world.entity(id).despawn();

    // Still there before update
    expect(world.entity(id).get(Position)).toEqual({ x: 5, y: 5 });

    world.update();

    expect(world.entity(id).get(Position)).toBeUndefined();
  });

  it("marks all components as removed", () => {
    const id = world.spawn(Position(0, 0), Velocity(1, 1));
    world.update();

    world.entity(id).despawn();
    world.update();

    expect(world.queryRemoved(Position)).toContain(id);
    expect(world.queryRemoved(Velocity)).toContain(id);
  });

  it("removes entity from queries", () => {
    const id = world.spawn(Position(0, 0));

    world.entity(id).despawn();
    world.update();

    const results = world.query(Entity, Position);
    expect(results.some(([e]) => e === id)).toBe(false);
  });
});

describe("EntityOperations.inspect", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("returns all component values", () => {
    const id = world.spawn(Position(1, 2), Health(100));

    const values = world.entity(id).inspect();

    expect(values).toHaveLength(2);
    expect(values).toContainEqual({ x: 1, y: 2 });
    expect(values).toContainEqual({ current: 100 });
  });

  it("returns empty array for non-existent entity", () => {
    expect(world.entity(9999).inspect()).toEqual([]);
  });
});
