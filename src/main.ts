import { App } from "./app/App.ts";
import { World } from "./ecs/World.ts";
import "./style.css";

class Game {
  constructor() {
    const world = new World();
    const app = new App(world);

    app.run();
  }
}

new Game();
