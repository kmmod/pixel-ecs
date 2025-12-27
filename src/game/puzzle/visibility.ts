import type { World } from "@ecs/World.ts";
import { RendererData } from "@game/renderer/renderer.ts";
import { resource } from "@ecs/Registry.ts";
import { Coordinate } from "@game/puzzle/pixel.ts";
import { MeshRef } from "@game/renderer/components.ts";

export interface VisibilityDataParams {
  zoomThreshold: number;
  coordinatesVisible: boolean;
}

export const VisibilityData = resource(
  (params: VisibilityDataParams) => params,
);

const zoomThreshold = 0.055;

export const initVisibility = (world: World) => {
  const params = {
    zoomThreshold,
    coordinatesVisible: true,
  };
  world.insertResource(VisibilityData(params));
};

export const coordinateVisibility = (world: World) => {
  const { camera } = world.getResource(RendererData);
  const { zoomThreshold, coordinatesVisible } =
    world.getResource(VisibilityData);

  let needsUpdate = false;
  if (camera.zoom < zoomThreshold && coordinatesVisible) {
    world.getResource(VisibilityData).coordinatesVisible = false;
    needsUpdate = true;
  } else if (camera.zoom >= zoomThreshold && !coordinatesVisible) {
    world.getResource(VisibilityData).coordinatesVisible = true;
    needsUpdate = true;
  }

  if (!needsUpdate) return;

  const query = world.query(Coordinate, MeshRef);

  for (const [_, meshRef] of query) {
    const coordinateMesh = meshRef.mesh;
    coordinateMesh.visible =
      world.getResource(VisibilityData).coordinatesVisible;
  }
};
