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

export interface PixelsParentProps {
  image: HTMLImageElement;
}

export const PixelsParent = component((props: PixelsParentProps) => props);

let puzzleMessageReader: MessageReader<FileMessageProps> | null = null;
export const generatePuzzle = (world: World) => {
  puzzleMessageReader ??= world.getMessageReader(FileMessage);

  for (const event of puzzleMessageReader.read()) {
    processFile(world, event.file);
  }
};

const processFile = (world: World, file: string) => {
  const image = new Image();
  image.src = file;
  image.onload = () => {
    // TODO: Take this from global config
    const skipTransparent = true;
    const pixels = generatePixels(image, skipTransparent);
    const coordinates = generateCoordinates(pixels, image.width, image.height);
    spawnPixels(world, pixels);
    spawnCoordinates(world, coordinates);
    world.spawn(PixelsParent({ image }));
  };
};
