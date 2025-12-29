import type { MessageReader } from "@ecs/Message.ts";
import { Entity, World } from "@ecs/World.ts";
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
import { Config } from "@game/globals/config.ts";
import { Coordinate, Pixel } from "@game/puzzle/pixel.ts";

export interface PixelsParentProps {
  image: HTMLImageElement;
}

export const PixelsParent = component((props: PixelsParentProps) => props);

let puzzleMessageReader: MessageReader<FileMessageProps> | null = null;
export const generatePuzzle = (world: World) => {
  puzzleMessageReader ??= world.getMessageReader(FileMessage);

  for (const event of puzzleMessageReader.read()) {
    removePuzzle(world);
    processFile(world, event.file);
  }
};

export const RegenerateMessage = message<{}>();

let regeneratePuzzleReader: MessageReader<{}> | null = null;
export const regeneratePuzzle = (world: World) => {
  regeneratePuzzleReader ??= world.getMessageReader(RegenerateMessage);

  const event = regeneratePuzzleReader.read();
  if (event.length === 0) {
    return;
  }

  const parentQuery = world.query(Entity, PixelsParent);
  for (const [, parent] of parentQuery) {
    const image = parent.image;
    removePuzzle(world);
    processFile(world, image.src);
  }
};

const removePuzzle = (world: World) => {
  const pixels = world.query(Entity, Pixel);
  const coordinates = world.query(Entity, Coordinate);
  const parent = world.query(Entity, PixelsParent);

  for (const [entity] of pixels) {
    world.entity(entity).despawn();
  }

  for (const [entity] of coordinates) {
    world.entity(entity).despawn();
  }

  for (const [entity] of parent) {
    world.entity(entity).despawn();
  }
};

const processFile = (world: World, file: string) => {
  console.log("Generating puzzle from file:", file);
  const image = new Image();
  image.src = file;
  image.onload = () => {
    const config = world.getResource(Config);
    const skipTransparent = config.skipTransparent;
    const pixels = generatePixels(image, skipTransparent);
    const coordinates = generateCoordinates(pixels, image.width, image.height);
    spawnPixels(world, pixels);
    spawnCoordinates(world, coordinates);
    world.spawn(PixelsParent({ image }));
  };
};
