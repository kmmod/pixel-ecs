import type { EventReader } from "@ecs/Event";
import { Entity, type World } from "@ecs/World";
import {
  PointerActionEvent,
  PointerButton,
  type PointerActionEventProps,
} from "@game/input/input";
import { MeshRef } from "@game/renderer/components";
import { RendererData } from "@game/renderer/renderer";
import { Pixel } from "./pixel";

let pointerDownReader: EventReader<PointerActionEventProps> | null = null;
export const selectPuzzle = (world: World) => {
  const rendererData = world.getResource(RendererData);
  const raycastId = rendererData.raycastResult[0] ?? null;

  pointerDownReader ??= world.getEventReader(PointerActionEvent);
  const event = pointerDownReader.read().pop();

  if (!event || event.pointerButton !== PointerButton.Left || !raycastId)
    return;

  const pixel = world.entity(raycastId).getMut(Pixel);

  if (pixel) {
    pixel.marked = !pixel.marked;
  }
};

const white = "#ffffff";
const black = "#000000";

export const changePuzzleColor = (world: World) => {
  const query = world.queryChanged(Entity, Pixel);

  for (const [entity, pixel] of query) {
    const meshRef = world.entity(entity).getMut(MeshRef);
    const material = meshRef?.mesh.material;
    if (material) {
      material.color.set(pixel.marked ? black : white);
      material.needsUpdate = true;
    }
  }
};
