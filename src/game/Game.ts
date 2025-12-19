import { App } from "../app/App";
import { component, event, resource } from "../ecs/Registry";
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

const Transform = component((x: number = 0, y: number = 0) => ({
  x,
  y,
}));

const RemoveEvent = event<{ entity: number }>();

const movementSystem = (world: World) => {
  const entity = world.spawn(Transform(10, 20));
  console.log("Spawning new Entity: ", entity);

  const removedQuery = world.queryRemoved(Entity, Transform);
  for (const ent of removedQuery) {
    console.log("WAS REMOVED", ent);
  }
};

const logSystem = (world: World) => {
  const query = world.queryAdded(Entity, Transform);

  for (const [entity, transform] of query) {
    console.log(entity, transform, "WAS ADDED");
    world.entity(entity).despawn();
  }

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

    world.spawn(Transform(0, 0));

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
