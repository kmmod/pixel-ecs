import { type World } from "@ecs/World";
import { message } from "@ecs/Registry";
import { Startup, Update } from "@ecs/Systems";

import sprite from "/sprite-01.png";
import { hoverAnimate, hoverAnimation, hoverPuzzle } from "./hover";
import { generatePuzzle } from "./generate/generate.ts";
import { handlePixelSelect, selectPuzzle } from "./select";
import {
  scaleAnimation,
  coordinateVisibility,
  initVisibility,
} from "@game/puzzle/visibility.ts";

export interface FileMessageProps {
  file: string;
}
export const FileMessage = message<FileMessageProps>();

const initPuzzle = (world: World) => {
  const writer = world.getMessageWriter(FileMessage);
  writer.write({ file: sprite });
};

export const puzzleBundle = (world: World) => {
  world.addSystem(Startup, [initPuzzle, initVisibility]);
  world.addSystem(Update, generatePuzzle);
  world.addSystem(Update, [hoverPuzzle, hoverAnimate, hoverAnimation]);
  world.addSystem(Update, [selectPuzzle, handlePixelSelect]);
  world.addSystem(Update, [coordinateVisibility, scaleAnimation]);
};
