import { Time } from "@app/App";
import { component } from "@ecs/Registry";
import { World, Entity } from "@ecs/World";
import { MeshComponent, Transform } from "@game/renderer/components";
import { RendererData } from "@game/renderer/renderer";
import { hoverScale, hoverSpeed, Pixel, pixelScale } from "./pixel";

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
  if (!rendererData) return;

  const raycastId = rendererData.raycastResult[0] ?? null;

  const query = world.query(Entity, MeshComponent, Pixel);
  for (const [entity] of query) {
    if (raycastId === entity) {
      world.entity(entity).insert(Hovered());
    } else {
      world.entity(entity).remove(Hovered);
    }
  }
};

export const hoverAnimation = (world: World) => {
  const added = world.queryAdded(Entity, Hovered, Transform);
  for (const [entity] of added) {
    world
      .entity(entity)
      .insert(HoverAnimation({ targetScale: hoverScale, speed: hoverSpeed }));
  }

  const removed = world.queryRemoved(Entity, Hovered);
  for (const entity of removed) {
    world
      .entity(entity)
      .insert(
        HoverAnimation({ targetScale: pixelScale, speed: hoverSpeed * 0.5 }),
      );
  }
};

export const hoverAnimate = (world: World) => {
  const time = world.getResource(Time);
  if (!time) return;

  const query = world.queryMut(Entity, Transform, HoverAnimation);
  for (const [entity, transform, hoverAnim] of query) {
    const current = transform.scale.x;
    const diff = hoverAnim.targetScale - current;
    if (Math.abs(diff) > 0.01) {
      transform.scale.setScalar(current + diff * hoverAnim.seed * time.delta);
    } else {
      transform.scale.setScalar(hoverAnim.targetScale);
      world.entity(entity).remove(HoverAnimation);
    }
  }
};
