import type { MessageReader } from "@ecs/Message";
import { Entity, type World } from "@ecs/World";
import { component, message } from "@ecs/Registry";
import {
  PointerAction,
  PointerActionMessage,
  type PointerActionMessageProps,
  PointerButton,
} from "@game/input/input";
import {
  getChildByTag,
  MeshRef,
  type MeshRefProps,
} from "@game/renderer/components";
import { RendererData } from "@game/renderer/renderer";
import {
  type Cell,
  Coordinate,
  type CoordinateProps,
  diagonalOffsets,
  Pixel,
  type PixelProps,
} from "./pixel";
import { Mesh } from "three";
import { PixelMesh } from "@game/puzzle/generate/generatePixels.ts";
import {
  CoordinateMesh,
  defaultCoordinateColor,
  errorCoordinateColor,
  solvedCoordinateColor,
} from "@game/puzzle/generate/generateCoordinates.ts";
import { Hovered } from "@game/puzzle/hover.ts";

export interface PixelSelectMessageProps {
  entityId: number;
}

export const PixelSelectMessage = message<PixelSelectMessageProps>();

export const Selectable = component(() => ({}));

let pointerActionReader: MessageReader<PointerActionMessageProps> | null = null;
let lastPixels: number[] = [];
export const selectPuzzle = (world: World) => {
  const rendererData = world.getResource(RendererData);
  const raycastId = rendererData.raycastResult[0] ?? null;

  pointerActionReader ??= world.getMessageReader(PointerActionMessage);
  const message = pointerActionReader.read().pop();

  if (!message || message.pointerButton !== PointerButton.Left || !raycastId) {
    return;
  }

  const pixel = world.entity(raycastId).getMut(Pixel);
  const isSelectable = world.entity(raycastId).has(Selectable);

  if (pixel && isSelectable && lastPixels.indexOf(raycastId) === -1) {
    pixel.marked = !pixel.marked;
    lastPixels.push(raycastId);
    world.getMessageWriter(PixelSelectMessage).write({ entityId: raycastId });
  }

  if (message.pointerAction === PointerAction.Up) {
    lastPixels = [];
  }
};

const white = "#ffffff";
const black = "#000000";

type QueryPixel = [number, PixelProps];
type QueryCoordinate = [number, CoordinateProps];

const isNeighbour = (cell: Cell, targetCell: Cell): boolean => {
  return diagonalOffsets.some(
    (offset) =>
      cell.x === targetCell.x + offset.x && cell.y === targetCell.y + offset.y,
  );
};

const updatePixelMeshColor = (meshRef: MeshRefProps, marked: boolean): void => {
  if (!meshRef) return;

  const child = getChildByTag(meshRef.mesh, PixelMesh.PlaneInner);
  if (child && child instanceof Mesh && child.material !== undefined) {
    child.material.color.set(marked ? black : white);
    child.material.needsUpdate = true;
  }
};

const getNeighbouringCoordinates = (
  pixelCell: Cell,
  coordinates: QueryCoordinate[],
) => {
  return coordinates.filter(([_, coord]) => isNeighbour(coord.cell, pixelCell));
};

const countMarkedNeighbouringPixels = (
  coordinateCell: Cell,
  pixels: QueryPixel[],
): number => {
  return pixels
    .filter(([_, p]) => isNeighbour(p.cell, coordinateCell))
    .reduce((sum, [_, p]) => sum + (p.marked ? 1 : 0), 0);
};

const getCoordinateColor = (
  markedCount: number,
  expectedValue: number,
): string => {
  if (markedCount === 0) return defaultCoordinateColor;
  if (markedCount === expectedValue) return solvedCoordinateColor;
  return errorCoordinateColor;
};

const updateCoordinateMeshColor = (
  meshRef: MeshRefProps,
  color: string,
): void => {
  if (!meshRef) return;

  const circleInner = getChildByTag(meshRef.mesh, CoordinateMesh.CircleInner);
  if (circleInner && circleInner instanceof Mesh && circleInner.material) {
    circleInner.material.color.set(color);
  }
};

const updateNeighbouringCoordinates = (
  pixel: PixelProps,
  pixels: QueryPixel[],
  coordinates: QueryCoordinate[],
  world: World,
): void => {
  const neighbouringCoords = getNeighbouringCoordinates(
    pixel.cell,
    coordinates,
  );

  neighbouringCoords.forEach(([entity, coord]) => {
    const coordMeshRef = world.entity(entity).get(MeshRef);
    if (!coordMeshRef) return;
    const markedCount = countMarkedNeighbouringPixels(coord.cell, pixels);
    const color = getCoordinateColor(markedCount, coord.value);
    updateCoordinateMeshColor(coordMeshRef, color);
  });
};

const checkPuzzleSolved = (pixels: QueryPixel[]): boolean => {
  return pixels.every(
    ([_, p]) => (p.value === 1 && p.marked) || (p.value === 0 && !p.marked),
  );
};

// Once puzzle is solved, remove Selectable from all pixels
const updateSolvedState = (
  pixels: QueryPixel[],
  coordinates: QueryCoordinate[],
  world: World,
): void => {
  const puzzleSolved = checkPuzzleSolved(pixels);
  if (puzzleSolved) {
    for (const [entity, _] of pixels) {
      world.entity(entity).remove(Selectable);
      world.entity(entity).remove(Hovered);
    }
    for (const [entity, _] of coordinates) {
      world.entity(entity).despawn();
    }
  }
};

let pixelSelectReader: MessageReader<PixelSelectMessageProps> | null = null;
export const handlePixelSelect = (world: World) => {
  pixelSelectReader ??= world.getMessageReader(PixelSelectMessage);
  const messages = pixelSelectReader.read();

  if (messages.length === 0) return;

  const pixels = world.query(Entity, Pixel);
  const coordinates = world.query(Entity, Coordinate);

  for (const message of messages) {
    const pixel = world.entity(message.entityId).get(Pixel);
    if (!pixel) continue;

    const meshRef = world.entity(message.entityId).get(MeshRef);
    if (!meshRef) continue;

    updatePixelMeshColor(meshRef, pixel.marked);
    updateNeighbouringCoordinates(pixel, pixels, coordinates, world);
    updateSolvedState(pixels, coordinates, world);
  }
};
