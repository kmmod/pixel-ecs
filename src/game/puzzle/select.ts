import type { MessageReader } from "@ecs/Message";
import { type World } from "@ecs/World";
import { message } from "@ecs/Registry";
import {
  PointerActionMessage,
  PointerButton,
  type PointerActionMessageProps,
} from "@game/input/input";
import { getChildByTag, MeshRef } from "@game/renderer/components";
import { RendererData } from "@game/renderer/renderer";
import { Pixel } from "./pixel";
import { PixelMesh } from "./generate";
import { Mesh } from "three";

export interface PixelSelectMessageProps {
  entityId: number;
}

export const PixelSelectMessage = message<PixelSelectMessageProps>();

let pointerDownReader: MessageReader<PointerActionMessageProps> | null = null;
export const selectPuzzle = (world: World) => {
  const rendererData = world.getResource(RendererData);
  const raycastId = rendererData.raycastResult[0] ?? null;

  pointerDownReader ??= world.getMessageReader(PointerActionMessage);
  const message = pointerDownReader.read().pop();

  if (!message || message.pointerButton !== PointerButton.Left || !raycastId)
    return;

  const pixel = world.entity(raycastId).getMut(Pixel);

  if (pixel) {
    pixel.marked = !pixel.marked;
    world.getMessageWriter(PixelSelectMessage).write({ entityId: raycastId });
  }
};

const white = "#ffffff";
const black = "#000000";

let pixelSelectReader: MessageReader<PixelSelectMessageProps> | null = null;
export const handlePixelSelect = (world: World) => {
  pixelSelectReader ??= world.getMessageReader(PixelSelectMessage);
  const messages = pixelSelectReader.read();

  for (const message of messages) {
    const pixel = world.entity(message.entityId).getMut(Pixel);
    const meshRef = world.entity(message.entityId).getMut(MeshRef);
    if (pixel && meshRef) {
      const child = getChildByTag(meshRef.mesh, PixelMesh.PlaneInner);
      if (child && child instanceof Mesh && child.material !== undefined) {
        child.material.color.set(pixel?.marked ? black : white);
        child.material.needsUpdate = true;
      }
    }
  }
};
