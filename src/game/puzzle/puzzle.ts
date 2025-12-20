import type { World } from "@ecs/World";
import { event } from "@ecs/Registry";

import sprite from "/test-sprite-01.png";
import type { EventReader } from "@ecs/Event";
import { Startup, Update } from "@ecs/Systems";

export interface PuzzleEventProps {
  file: string;
}
const PuzzleEvent = event<PuzzleEventProps>();

const initPuzzle = (world: World) => {
  const writer = world.getEventWriter(PuzzleEvent);
  writer.send({ file: sprite });
};

let puzzleEventReader: EventReader<PuzzleEventProps> | null = null;
const generatePuzzle = (world: World) => {
  puzzleEventReader ??= world.getEventReader(PuzzleEvent);

  for (const event of puzzleEventReader.read()) {
    console.log("Generating puzzle from file:", event.file);
  }
};

export const puzzleBundle = (world: World) => {
  world.addSystem(Startup, initPuzzle);
  world.addSystem(Update, generatePuzzle);
};
