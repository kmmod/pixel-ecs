import { type World } from "@ecs/World";
import { event } from "@ecs/Registry";
import { Startup, Update } from "@ecs/Systems";

import sprite from "/test-sprite-01.png";
import { hoverAnimate, hoverAnimation, hoverPuzzle } from "./hover";
import { generatePuzzle } from "./generate";
import { changePuzzleColor, selectPuzzle } from "./select";

export interface FileEventProps {
  file: string;
}
export const FileEvent = event<FileEventProps>();

const initPuzzle = (world: World) => {
  const writer = world.getEventWriter(FileEvent);
  writer.send({ file: sprite });
};

export const puzzleBundle = (world: World) => {
  world.addSystem(Startup, initPuzzle);
  world.addSystem(Update, generatePuzzle);
  world.addSystem(Update, [hoverPuzzle, hoverAnimate, hoverAnimation]);
  world.addSystem(Update, [selectPuzzle, changePuzzleColor]);
};
