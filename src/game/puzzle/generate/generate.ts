import type { MessageReader } from "@ecs/Message.ts";
import { World } from "@ecs/World.ts";
import { FileMessage, type FileMessageProps } from "../puzzle.ts";
import { component, message } from "@ecs/Registry.ts";
import {
  generatePixels,
  spawnPixels,
} from "@game/puzzle/generate/generatePixels.ts";
import {
  generateCoordinates,
  spawnCoordinates,
} from "@game/puzzle/generate/generateCoordinates.ts";

export const PixelsGenerated = message<{}>();

export const CameraTransitionFlag = component(() => ({}));

let puzzleMessageReader: MessageReader<FileMessageProps> | null = null;
export const generatePuzzle = (world: World) => {
  puzzleMessageReader ??= world.getMessageReader(FileMessage);

  for (const event of puzzleMessageReader.read()) {
    processFile(world, event.file);
    console.log("generatePuzzle executed");
  }
};

const processFile = (world: World, file: string) => {
  const img = new Image();
  img.src = file;
  img.onload = () => {
    const pixels = generatePixels(img);
    const coordinates = generateCoordinates(pixels, img.width, img.height);
    spawnPixels(world, pixels);
    spawnCoordinates(world, coordinates);
    world.spawn(CameraTransitionFlag());
  };
};
