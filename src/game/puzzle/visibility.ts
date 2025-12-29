import { Entity, type World } from "@ecs/World.ts";
import { RendererData } from "@game/renderer/renderer.ts";
import { component, resource } from "@ecs/Registry.ts";
import { Coordinate } from "@game/puzzle/pixel.ts";
import { MeshRef } from "@game/renderer/components.ts";
import { Time } from "@app/App.ts";

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

interface ScaleAnimationParams {
  targetScale: number;
  speed: number;
}

const ScaleAnimation = component((params: ScaleAnimationParams) => params);

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

  const query = world.query(Entity, Coordinate);

  for (const [entity] of query) {
    world.entity(entity).insert(
      ScaleAnimation({
        targetScale: world.getResource(VisibilityData).coordinatesVisible
          ? 1
          : 0,
        speed: Math.max(6, Math.min(15, Math.random() * 15)),
      }),
    );
  }
};

export const scaleAnimation = (world: World) => {
  const query = world.query(Entity, MeshRef, ScaleAnimation);
  const time = world.getResource(Time);

  for (const [entity, meshRef, visibilityAnim] of query) {
    const scale = meshRef.mesh.scale.x;
    const scaleDiff = visibilityAnim.targetScale - scale;
    const scaleDone = Math.abs(scaleDiff) <= 0.01;

    if (visibilityAnim.targetScale > 0 && !meshRef.mesh.visible) {
      meshRef.mesh.visible = true;
    }

    if (!scaleDone) {
      const newScale = scale + scaleDiff * visibilityAnim.speed * time.delta;
      meshRef.mesh.scale.setScalar(newScale);
    } else {
      meshRef.mesh.scale.setScalar(visibilityAnim.targetScale);
      world.entity(entity).remove(ScaleAnimation);
      if (visibilityAnim.targetScale === 0) {
        meshRef.mesh.visible = false;
      }
    }
  }
};
