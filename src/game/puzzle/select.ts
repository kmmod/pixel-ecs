import type { MessageReader } from "@ecs/Message";
import { Entity, type World } from "@ecs/World";
import { message } from "@ecs/Registry";
import {
  PointerActionMessage,
  PointerButton,
  type PointerActionMessageProps,
} from "@game/input/input";
import { getChildByTag, MeshRef } from "@game/renderer/components";
import { RendererData } from "@game/renderer/renderer";
import { Coordinate, Pixel } from "./pixel";
import { Mesh } from "three";
import { PixelMesh } from "@game/puzzle/generate/generatePixels.ts";
import {
  CoordinateMesh,
  defaultCoordinateColor,
  errorCoordinateColor,
  solvedCoordinateColor,
} from "@game/puzzle/generate/generateCoordinates.ts";

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

  if (messages.length === 0) return;

  const pixels = world.query(Entity, Pixel);
  const coordinates = world.query(Entity, Coordinate);

  for (const message of messages) {
    const pixel = world.entity(message.entityId).get(Pixel);
    const meshRef = world.entity(message.entityId).get(MeshRef);

    if (!pixel) continue;

    // Update pixel color
    if (meshRef) {
      const child = getChildByTag(meshRef.mesh, PixelMesh.PlaneInner);
      if (child && child instanceof Mesh && child.material !== undefined) {
        child.material.color.set(pixel?.marked ? black : white);
        child.material.needsUpdate = true;
      }
    }

    // Find neighboring coordinates and see if any needs to marked as error
    const pixelCell = pixel.cell;
    const neighbourOffsets = [
      { x: -1, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: -1 },
    ];

    const coords = coordinates.filter(([_, coord]) => {
      return neighbourOffsets.some(
        (offset) =>
          coord.cell.x === pixelCell.x + offset.x &&
          coord.cell.y === pixelCell.y + offset.y,
      );
    });

    // For each neighboring coordinate, count marked pixels and compare to expected value
    // Very ugly but works
    // Looking up from world each time is not optimal but avoids maintaining extra state
    // We could have a map of entityId to Pixel/Coordinate and keep it on resource for faster access
    coords.forEach(([entity, coord]) => {
      const coordMeshRef = world.entity(entity).get(MeshRef);
      if (!coordMeshRef) return;
      const pixelsValue = pixels
        .filter(([_, p]) => {
          return neighbourOffsets.some(
            (offset) =>
              p.cell.x === coord.cell.x + offset.x &&
              p.cell.y === coord.cell.y + offset.y,
          );
        })
        .reduce((sum, [_, p]) => sum + (p.marked ? 1 : 0), 0);

      const expectedValue = coord.value;

      // Update coordinate color based on whether the pixel count matches the expected value
      const circleInner = getChildByTag(
        coordMeshRef.mesh,
        CoordinateMesh.CircleInner,
      );
      if (circleInner && circleInner instanceof Mesh && circleInner.material) {
        if (pixelsValue === 0) {
          circleInner.material.color.set(defaultCoordinateColor);
        } else if (pixelsValue === expectedValue) {
          circleInner.material.color.set(solvedCoordinateColor);
        } else {
          circleInner.material.color.set(errorCoordinateColor);
        }
      }
    });
  }
};
