import { App } from "@app/App";
import { World } from "@ecs/World";
import { rendererBundle } from "./renderer/renderer";
import { puzzleBundle } from "./puzzle/puzzle";

export class Game {
  constructor() {
    const world = new World();
    const app = new App(world);

    puzzleBundle(world);
    rendererBundle(world);

    app.run();
  }
}
