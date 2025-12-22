import type { World } from "@ecs/World";
import { RendererData } from "./renderer";
import { Mesh, Vector2 } from "three";
import type { EventReader } from "@ecs/Event";
import {
  PointerMoveEvent,
  type PointerMoveEventProps,
} from "@game/input/input";

let pointerMoveReader: EventReader<PointerMoveEventProps> | null = null;
export const raycastUpdate = (world: World) => {
  const rendererData = world.getResource(RendererData);
  pointerMoveReader ??= world.getEventReader(PointerMoveEvent);

  // get only last event
  const event = pointerMoveReader.read().pop();
  if (!event) return;

  const { camera, scene, raycast, raycastResult } = rendererData;

  const x = (event.mouseX / window.innerWidth) * 2 - 1;
  const y = -(event.mouseY / window.innerHeight) * 2 + 1;

  const coords = new Vector2(x, y);

  raycastResult.length = 0;
  raycast.setFromCamera(coords, camera);
  raycast.intersectObjects(scene.children, true).forEach((hit) => {
    if (hit.object instanceof Mesh) {
      raycastResult.push(parseInt(hit.object.name));
    }
  });
};
