import { App } from "@app/App";
import { World } from "@ecs/World";
import { rendererBundle } from "./renderer/renderer";
import { puzzleBundle } from "./puzzle/puzzle";
import { inputBundle } from "./input/input";
import { guiBundle } from "@game/gui/gui.ts";
import { globalsBundle } from "@game/globals/globals.ts";

export class Game {
  constructor() {
    const world = new World();
    const app = new App(world);

    globalsBundle(world);
    inputBundle(world);
    guiBundle(world);
    puzzleBundle(world);
    rendererBundle(world);

    app.run();
  }
}
