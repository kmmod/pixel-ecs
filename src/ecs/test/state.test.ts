import { describe, it, expect, beforeEach, vi } from "vitest";
import { World } from "../../ecs/World";
import { state, OnEnter, OnExit } from "../../ecs/State";

const GameStates = {
  Menu: "menu",
  Playing: "playing",
  Paused: "paused",
} as const;

const GameState = state(GameStates, GameStates.Menu);

describe("state", () => {
  it("creates state token with initial value", () => {
    expect(GameState.initial).toBe("menu");
  });

  it("creates state values for each key", () => {
    expect(GameState.Menu).toEqual({ state: GameState, value: "menu" });
    expect(GameState.Playing).toEqual({ state: GameState, value: "playing" });
    expect(GameState.Paused).toEqual({ state: GameState, value: "paused" });
  });
});

describe("World.insertState", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("registers state with initial value", () => {
    world.insertState(GameState);

    expect(world.getState(GameState)).toBe("menu");
  });
});

describe("World.setState", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    world.insertState(GameState);
  });

  it("transitions to new state", () => {
    world.setState(GameState.Playing);
    world.update();

    expect(world.getState(GameState)).toBe("playing");
  });

  it("ignores transition to same state", () => {
    const onEnter = vi.fn();
    world.addSystem(OnEnter(GameState.Menu), onEnter);

    world.update(); // initial OnEnter
    onEnter.mockClear();

    world.setState(GameState.Menu); // same state
    world.update();

    expect(onEnter).not.toHaveBeenCalled();
  });
});

describe("World.getState", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("returns undefined for unregistered state", () => {
    expect(world.getState(GameState)).toBeUndefined();
  });

  it("returns current state value", () => {
    world.insertState(GameState);
    world.setState(GameState.Playing);
    world.update();

    expect(world.getState(GameState)).toBe("playing");
  });
});

describe("OnEnter", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    world.insertState(GameState);
  });

  it("runs on initial state during first update", () => {
    const onEnter = vi.fn();
    world.addSystem(OnEnter(GameState.Menu), onEnter);

    world.update();

    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("runs when transitioning to state", () => {
    const onEnter = vi.fn();
    world.addSystem(OnEnter(GameState.Playing), onEnter);

    world.update(); // initial
    expect(onEnter).not.toHaveBeenCalled();

    world.setState(GameState.Playing);
    world.update();

    expect(onEnter).toHaveBeenCalledOnce();
  });

  it("does not run for other states", () => {
    const onEnterPaused = vi.fn();
    world.addSystem(OnEnter(GameState.Paused), onEnterPaused);

    world.setState(GameState.Playing);
    world.update();

    expect(onEnterPaused).not.toHaveBeenCalled();
  });
});

describe("OnExit", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    world.insertState(GameState);
  });

  it("runs when leaving state", () => {
    const onExit = vi.fn();
    world.addSystem(OnExit(GameState.Menu), onExit);

    world.update(); // initial enter
    expect(onExit).not.toHaveBeenCalled();

    world.setState(GameState.Playing);
    world.update();

    expect(onExit).toHaveBeenCalledOnce();
  });

  it("does not run for other states", () => {
    const onExitPaused = vi.fn();
    world.addSystem(OnExit(GameState.Paused), onExitPaused);

    world.update();
    world.setState(GameState.Playing);
    world.update();

    expect(onExitPaused).not.toHaveBeenCalled();
  });

  it("runs before OnEnter of new state", () => {
    const order: string[] = [];
    world.addSystem(OnExit(GameState.Menu), () => order.push("exit"));
    world.addSystem(OnEnter(GameState.Playing), () => order.push("enter"));

    world.update(); // initial
    world.setState(GameState.Playing);
    world.update();

    expect(order).toEqual(["exit", "enter"]);
  });
});

describe("state transitions", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    world.insertState(GameState);
  });

  it("handles multiple transitions", () => {
    const states: string[] = [];
    world.addSystem(OnEnter(GameState.Menu), () => states.push("menu"));
    world.addSystem(OnEnter(GameState.Playing), () => states.push("playing"));
    world.addSystem(OnEnter(GameState.Paused), () => states.push("paused"));

    world.update(); // menu
    world.setState(GameState.Playing);
    world.update();
    world.setState(GameState.Paused);
    world.update();

    expect(states).toEqual(["menu", "playing", "paused"]);
  });
});
