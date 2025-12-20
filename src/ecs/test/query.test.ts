import { describe, it, expect, beforeEach } from "vitest";
import { World, Entity } from "../../ecs/World";
import { component } from "../../ecs/Registry";

const Position = component((x: number, y: number) => ({ x, y }));
const Velocity = component((x: number, y: number) => ({ x, y }));

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
