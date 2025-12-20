import { App } from "../app/App";
import { World } from "../ecs/World";
import { rendererPlugin } from "./renderer/rendererPlugin";

export class Game {
  constructor() {
    const world = new World();
    const app = new App(world);

    rendererPlugin(world);

    app.run();
  }
}
