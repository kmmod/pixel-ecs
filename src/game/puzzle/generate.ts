import type { EventReader } from "@ecs/Event";
import { World } from "@ecs/World";
import {
  MeshComponent,
  Transform,
  CameraAnimation,
} from "@game/renderer/components";
import { Vector3, BoxGeometry, MeshBasicMaterial, Mesh } from "three";
import { type FileEventProps, FileEvent } from "./puzzle";

let puzzleEventReader: EventReader<FileEventProps> | null = null;
export const generatePuzzle = (world: World) => {
  puzzleEventReader ??= world.getEventReader(FileEvent);

  for (const event of puzzleEventReader.read()) {
    console.log("Generating puzzle from file:", event.file);

    const size = 16;
    spawnGrid(world, size);
    updateZoom(world, size);
  }
};

export const spawnGrid = (world: World, size: number) => {
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const offset = (size - 1) / 2;
      const position = new Vector3(x - offset, y - offset, 0);
      const scale = new Vector3().setScalar(0.98);
      const geometry = new BoxGeometry(1, 1, 1);
      const material = new MeshBasicMaterial({ color: "#156289" });
      const cube = new Mesh(geometry, material);
      world.spawn(MeshComponent(cube), Transform({ position, scale }));
    }
  }
};

const updateZoom = (world: World, size: number) => {
  world.spawn(CameraAnimation({ targetZoom: 1.0 / size, speed: 0.25 }));
};
