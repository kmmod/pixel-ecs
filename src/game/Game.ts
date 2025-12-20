import { App } from "../app/App";
import { World } from "../ecs/World";
import { createRenderer } from "./renderer/renderer";

export class Game {
  constructor() {
    const world = new World();
    const app = new App(world);

    createRenderer(world);

    app.run();
  }
}
