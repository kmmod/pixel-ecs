import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../../ecs/World";
import { resource } from "../../ecs/Registry";

const Time = resource(() => ({ delta: 0, elapsed: 0 }));
const Config = resource((difficulty: number) => ({ difficulty }));
const Input = resource(() => ({ keys: new Set<string>() }));

describe("World.insertResource", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("inserts a resource", () => {
    world.insertResource(Time());

    expect(world.getResource(Time)).toEqual({ delta: 0, elapsed: 0 });
  });

  it("inserts resource with arguments", () => {
    world.insertResource(Config(3));

    expect(world.getResource(Config)).toEqual({ difficulty: 3 });
  });

  it("overwrites existing resource", () => {
    world.insertResource(Config(1));
    world.insertResource(Config(5));

    expect(world.getResource(Config)).toEqual({ difficulty: 5 });
  });

  it("chains multiple inserts", () => {
    world
      .insertResource(Time())
      .insertResource(Config(2))
      .insertResource(Input());

    expect(world.getResource(Time)).toBeDefined();
    expect(world.getResource(Config)).toBeDefined();
    expect(world.getResource(Input)).toBeDefined();
  });
});

describe("World.getResource", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("returns undefined for missing resource", () => {
    expect(world.getResource(Time)).toBeUndefined();
  });

  it("returns mutable reference", () => {
    world.insertResource(Time());

    const time = world.getResource(Time)!;
    time.delta = 0.016;
    time.elapsed = 1.5;

    expect(world.getResource(Time)).toEqual({ delta: 0.016, elapsed: 1.5 });
  });

  it("handles complex resource types", () => {
    world.insertResource(Input());

    const input = world.getResource(Input)!;
    input.keys.add("w");
    input.keys.add("a");

    expect(world.getResource(Input)!.keys.has("w")).toBe(true);
    expect(world.getResource(Input)!.keys.size).toBe(2);
  });
});

describe("World.removeResource", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("removes existing resource", () => {
    world.insertResource(Time());

    const removed = world.removeResource(Time);

    expect(removed).toBe(true);
    expect(world.getResource(Time)).toBeUndefined();
  });

  it("returns false for missing resource", () => {
    const removed = world.removeResource(Time);

    expect(removed).toBe(false);
  });

  it("allows re-inserting after removal", () => {
    world.insertResource(Config(1));
    world.removeResource(Config);
    world.insertResource(Config(99));

    expect(world.getResource(Config)).toEqual({ difficulty: 99 });
  });
});
