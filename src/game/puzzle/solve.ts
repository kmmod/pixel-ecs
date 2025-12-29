import { message } from "@ecs/Registry.ts";
import type { MessageReader } from "@ecs/Message.ts";
import { Entity, type World } from "@ecs/World.ts";
import { Pixel } from "@game/puzzle/pixel.ts";
import { getChildByTag, MeshRef } from "@game/renderer/components.ts";
import { PixelMesh } from "@game/puzzle/generate/generatePixels.ts";
import { Mesh } from "three";
import { PixelSelectMessage } from "@game/puzzle/select.ts";

export const SolveMessage = message<{}>();

// TODO: There is some overlap with selectPuzzle that could be refactored
// Hacky and ugly, but works

const black = "#000000";
let solveMessageReader: MessageReader<{}> | null = null;
export const solvePuzzle = (world: World) => {
  solveMessageReader ??= world.getMessageReader(SolveMessage);

  const event = solveMessageReader.read();
  if (event.length === 0) {
    return;
  }

  const pixels = world.queryMut(Entity, Pixel, MeshRef);
  if (pixels.length === 0) {
    return;
  }

  const firstPixel = pixels[0][0];
  world.getMessageWriter(PixelSelectMessage).write({ entityId: firstPixel });

  for (const [_, pixel, meshRef] of pixels) {
    if (pixel.value === 0) {
      continue;
    }
    pixel.marked = true;

    const child = getChildByTag(meshRef.mesh, PixelMesh.PlaneInner);
    if (child && child instanceof Mesh && child.material !== undefined) {
      child.material.color.set(black);
      child.material.needsUpdate = true;
    }
  }
};
