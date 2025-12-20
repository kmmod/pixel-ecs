import { describe, it, expect, beforeEach, vi } from "vitest";
import { World } from "../../ecs/World";
import {
  Startup,
  PreUpdate,
  Update,
  PostUpdate,
  Render,
} from "../../ecs/Systems";

describe("World.init", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("runs Startup systems", () => {
    const fn = vi.fn();
    world.addSystem(Startup, fn);

    world.init();

    expect(fn).toHaveBeenCalledOnce();
  });

  it("runs Startup systems in order", () => {
    const order: number[] = [];
    world.addSystem(Startup, () => order.push(1));
    world.addSystem(Startup, () => order.push(2));
    world.addSystem(Startup, () => order.push(3));

    world.init();

    expect(order).toEqual([1, 2, 3]);
  });

  it("does not run Update systems", () => {
    const fn = vi.fn();
    world.addSystem(Update, fn);

    world.init();

    expect(fn).not.toHaveBeenCalled();
  });
});

describe("World.update", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("runs stages in correct order", () => {
    const order: string[] = [];
    world.addSystem(Render, () => order.push("Render"));
    world.addSystem(PreUpdate, () => order.push("PreUpdate"));
    world.addSystem(PostUpdate, () => order.push("PostUpdate"));
    world.addSystem(Update, () => order.push("Update"));

    world.update();

    expect(order).toEqual(["PreUpdate", "Update", "PostUpdate", "Render"]);
  });

  it("runs systems within stage in order", () => {
    const order: number[] = [];
    world.addSystem(Update, () => order.push(1));
    world.addSystem(Update, () => order.push(2));
    world.addSystem(Update, () => order.push(3));

    world.update();

    expect(order).toEqual([1, 2, 3]);
  });

  it("does not run Startup systems", () => {
    const fn = vi.fn();
    world.addSystem(Startup, fn);

    world.update();

    expect(fn).not.toHaveBeenCalled();
  });

  it("passes world to systems", () => {
    let receivedWorld: World | null = null;
    world.addSystem(Update, (w) => {
      receivedWorld = w;
    });

    world.update();

    expect(receivedWorld).toBe(world);
  });
});

describe("World.addSystem", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("adds single system", () => {
    const fn = vi.fn();
    world.addSystem(Update, fn);

    world.update();

    expect(fn).toHaveBeenCalledOnce();
  });

  it("adds array of systems", () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    world.addSystem(Update, [fn1, fn2]);

    world.update();

    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it("chains addSystem calls", () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    world.addSystem(Update, fn1).addSystem(Update, fn2);

    world.update();

    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it("supports conditional systems with when", () => {
    let shouldRun = false;
    const fn = vi.fn();

    world.addSystem(Update, fn, {
      when: [() => shouldRun],
    });

    world.update();
    expect(fn).not.toHaveBeenCalled();

    shouldRun = true;
    world.update();
    expect(fn).toHaveBeenCalledOnce();
  });

  it("requires all conditions to pass", () => {
    const fn = vi.fn();

    world.addSystem(Update, fn, {
      when: [() => true, () => false],
    });

    world.update();

    expect(fn).not.toHaveBeenCalled();
  });
});

describe("deferred operations", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("processes despawns at end of update", () => {
    const id = world.spawn();

    world.addSystem(Update, (w) => {
      w.entity(id).despawn();
      // Still exists during this frame
      expect(w.entity(id).inspect()).toBeDefined();
    });

    world.update();

    // Gone after update
    expect(world.query()).toEqual([]);
  });
});
