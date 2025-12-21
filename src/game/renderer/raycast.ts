import type { World } from "@ecs/World";
import { RendererData } from "./renderer";
import { Mesh, Vector2 } from "three";
import type { EventReader } from "@ecs/Event";
import { InputEvent, type InputEventProps } from "@game/input/input";

let inputEventReader: EventReader<InputEventProps> | null = null;
export const raycastUpdate = (world: World) => {
  const rendererData = world.getResource(RendererData);
  if (!rendererData) {
    return;
  }

  inputEventReader ??= world.getEventReader(InputEvent);

  // get only last event
  const event = inputEventReader.read().pop();
  if (!event) {
    return;
  }

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
