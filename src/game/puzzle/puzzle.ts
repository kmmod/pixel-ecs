import { Entity, type World } from "@ecs/World";
import { component, event } from "@ecs/Registry";
import type { EventReader } from "@ecs/Event";
import { Startup, Update } from "@ecs/Systems";

import sprite from "/test-sprite-01.png";
import { BoxGeometry, MeshBasicMaterial, Mesh, Vector3 } from "three";
import {
  CameraAnimation,
  MeshComponent,
  Transform,
} from "@game/renderer/components";
import { RendererData } from "@game/renderer/renderer";
import { Time } from "@app/App";

export interface PuzzleEventProps {
  file: string;
}
const PuzzleEvent = event<PuzzleEventProps>();

const initPuzzle = (world: World) => {
  const writer = world.getEventWriter(PuzzleEvent);
  writer.send({ file: sprite });
};

let puzzleEventReader: EventReader<PuzzleEventProps> | null = null;
const generatePuzzle = (world: World) => {
  puzzleEventReader ??= world.getEventReader(PuzzleEvent);

  for (const event of puzzleEventReader.read()) {
    console.log("Generating puzzle from file:", event.file);

    const size = 16;
    spawnGrid(world, size);
    updateZoom(world, size);
  }
};

const spawnGrid = (world: World, size: number) => {
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

export interface HoverAnimationProps {
  targetScale: number;
  speed: number;
}

export const HoverAnimation = component((props: HoverAnimationProps) => ({
  targetScale: props.targetScale ?? 1.0,
  seed: props.speed ?? 1.0,
}));

let previouslyHovered: number | null = null;
const hoverPuzzle = (world: World) => {
  const rendererData = world.getResource(RendererData);
  if (!rendererData) return;

  const raycastId = rendererData.raycastResult[0] ?? null;

  // Changed hover target
  if (raycastId !== previouslyHovered) {
    // Animate old one back
    if (previouslyHovered !== null) {
      const prev = world.entity(previouslyHovered);
      if (prev.has(HoverAnimation)) {
        prev.getMut(HoverAnimation)!.targetScale = 0.98;
      } else {
        prev.insert(HoverAnimation({ targetScale: 0.98, speed: 5.0 }));
      }
    }

    // Animate new one down
    if (raycastId !== null) {
      world
        .entity(raycastId)
        .insert(HoverAnimation({ targetScale: 0.8, speed: 5.0 }));
    }

    previouslyHovered = raycastId;
  }
};

const hoverAnimate = (world: World) => {
  const time = world.getResource(Time);
  if (!time) return;

  const query = world.queryMut(Entity, Transform, HoverAnimation);
  for (const [entity, transform, hoverAnim] of query) {
    const diff = hoverAnim.targetScale - transform.scale.x;
    if (Math.abs(diff) > 0.01) {
      transform.scale.x += diff * hoverAnim.seed * time.delta;
      transform.scale.y += diff * hoverAnim.seed * time.delta;
      transform.scale.z += diff * hoverAnim.seed * time.delta;
    } else {
      transform.scale.x = hoverAnim.targetScale;
      transform.scale.y = hoverAnim.targetScale;
      transform.scale.z = hoverAnim.targetScale;
      world.entity(entity).remove(HoverAnimation);
    }
  }
};

export const puzzleBundle = (world: World) => {
  world.addSystem(Startup, initPuzzle);
  world.addSystem(Update, generatePuzzle);
  world.addSystem(Update, hoverPuzzle);
  world.addSystem(Update, hoverAnimate);
};
