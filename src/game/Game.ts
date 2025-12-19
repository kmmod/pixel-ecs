import { App } from "../app/App";
import { resource } from "../ecs/Registry";
import { OnEnter, OnExit, state } from "../ecs/State";
import { Update } from "../ecs/Systems";
import { World, Entity } from "../ecs/World";

const GameStates = {
  Menu: "menu",
  Running: "running",
  Paused: "paused",
} as const;

const GameState = state(GameStates, GameStates.Menu);

const Input = resource(() => ({
  up: false,
  down: false,
  left: false,
  right: false,
}));

const movementSystem = (world: World) => {
  const entity = world.spawn();
  console.log("Spawning new Entity: ", entity);
};

const logSystem = (world: World) => {
  const query = world.query(Entity);

  const state = world.getState(GameState);

  console.log("Current Game State:", state === GameStates.Menu);
  console.log("Logging Entities:", query.length);

  world.setState(GameState.Running);
};

const lessThanFiveEntities = (world: World) => {
  const query = world.query(Entity);
  return query.length < 5;
};

export class Game {
  constructor() {
    const world = new World();
    const app = new App(world);

    world.insertState(GameState);
    world.insertResource(Input());

    world.spawn();

    world.addSystem(Update, movementSystem);
    world.addSystem(Update, logSystem, { when: [lessThanFiveEntities] });

    world.addSystem(OnExit(GameState.Menu), () => {
      console.log("Game quits menu!");
    });

    world.addSystem(OnEnter(GameState.Running), () => {
      console.log("Game started!");
    });

    app.run();

    setTimeout(() => {
      app.stop();
    }, 100);
  }
}
