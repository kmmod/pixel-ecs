import { Time } from "@app/App";
import { component } from "@ecs/Registry";
import { Entity, World } from "@ecs/World";
import { getChildByTag, MeshRef } from "@game/renderer/components";
import { RendererData } from "@game/renderer/renderer";
import { Mesh } from "three";
import { PixelMesh } from "./generate";
import { hoverScale, hoverSpeed, innerScale, Pixel } from "./pixel";

export const Hovered = component(() => ({}));

export interface HoverAnimationProps {
  targetScale: number;
  speed: number;
}

export const HoverAnimation = component((props: HoverAnimationProps) => ({
  targetScale: props.targetScale ?? 1.0,
  seed: props.speed ?? 1.0,
}));

export const hoverPuzzle = (world: World) => {
  const rendererData = world.getResource(RendererData);
  const raycastId = rendererData.raycastResult[0] ?? null;

  const query = world.query(Entity, Pixel);
  for (const [entity] of query) {
    if (raycastId === entity) {
      world.entity(entity).insert(Hovered());
    } else {
      world.entity(entity).remove(Hovered);
    }
  }
};

export const hoverAnimation = (world: World) => {
  const added = world.queryAdded(Entity, Pixel, Hovered);
  for (const [entity] of added) {
    world
      .entity(entity)
      .insert(HoverAnimation({ targetScale: hoverScale, speed: hoverSpeed }));
  }

  const removed = world.queryRemoved(Entity, Pixel, Hovered);
  for (const entity of removed) {
    world
      .entity(entity)
      .insert(
        HoverAnimation({ targetScale: innerScale, speed: hoverSpeed * 0.5 }),
      );
  }
};

export const hoverAnimate = (world: World) => {
  const time = world.getResource(Time);

  const query = world.queryMut(Entity, MeshRef, HoverAnimation, Pixel);
  for (const [entity, meshRef, hoverAnim] of query) {
    const child = getChildByTag(meshRef.mesh, PixelMesh.PlaneInner);
    if (child && child instanceof Mesh) {
      const current = child.scale.x;
      const diff = hoverAnim.targetScale - current;
      if (Math.abs(diff) > 0.01) {
        child.scale.setScalar(current + diff * hoverAnim.seed * time.delta);
      } else {
        child.scale.setScalar(hoverAnim.targetScale);
        world.entity(entity).remove(HoverAnimation);
      }
    }
  }
};
