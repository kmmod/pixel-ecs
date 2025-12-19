import { App } from "./app/App.ts";
import { Update } from "./ecs/Systems.ts";
import { Entity, World } from "./ecs/World.ts";
import "./style.css";

const movementSystem = (world: World) => {
  const entity = world.spawn();
  console.log("Spawning new Entity: ", entity);
};

const logSystem = (world: World) => {
  const query = world.query(Entity);

  console.log("Logging Entities:", query.length);
};

const lessThanFiveEntities = (world: World) => {
  const query = world.query(Entity);
  return query.length < 5;
};

class Game {
  constructor() {
    const world = new World();
    const app = new App(world);

    world.spawn();

    world.addSystem(Update, movementSystem);
    world.addSystem(Update, logSystem, { when: [lessThanFiveEntities] });

    app.run();

    setTimeout(() => {
      app.stop();
    }, 100);
  }
}

new Game();
