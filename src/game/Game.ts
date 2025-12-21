import { App } from "@app/App";
import { World } from "@ecs/World";
import { rendererBundle } from "./renderer/renderer";
import { puzzleBundle } from "./puzzle/puzzle";
import { inputBundle } from "./input/input";

export class Game {
  constructor() {
    const world = new World();
    const app = new App(world);

    inputBundle(world);
    puzzleBundle(world);
    rendererBundle(world);

    app.run();
  }
}
