import { Entity, type World } from "@ecs/World";
import { event } from "@ecs/Registry";
import type { EventReader } from "@ecs/Event";
import { Startup, Update } from "@ecs/Systems";

import sprite from "/test-sprite-01.png";
import { BoxGeometry, MeshBasicMaterial, Mesh } from "three";
import { MeshComponent, Transform } from "@game/renderer/components";
import { Time } from "@app/App";

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

    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new Mesh(geometry, material);
    world.spawn(MeshComponent(cube), Transform());
  }
};

const moveMeshes = (world: World) => {
  const time = world.getResource(Time);
  const delta = time ? time.delta : 0;
  const query = world.queryMut(Transform, MeshComponent);

  for (const [transform] of query) {
    transform.position.x += 0.1 * delta;
    transform.position.y += 0.1 * delta;
  }
};

const removeMesh = (world: World) => {
  const time = world.getResource(Time);
  if (time && time.elapsed < 2.0) return;

  const query = world.query(Entity, MeshComponent);

  for (const [entity, _] of query) {
    world.entity(entity).despawn();
  }
};

export const puzzleBundle = (world: World) => {
  world.addSystem(Startup, initPuzzle);
  world.addSystem(Update, generatePuzzle);
  world.addSystem(Update, moveMeshes);
  world.addSystem(Update, removeMesh);
};
