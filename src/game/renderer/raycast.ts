import type { World } from "@ecs/World";
import { RendererData } from "./renderer";
import { Mesh, Vector2 } from "three";
import type { MessageReader } from "@ecs/Message";
import {
  PointerActionMessage,
  type PointerActionMessageProps,
} from "@game/input/input.ts";

let pointerActionReader: MessageReader<PointerActionMessageProps> | null = null;
export const raycastUpdate = (world: World) => {
  const rendererData = world.getResource(RendererData);
  pointerActionReader ??= world.getMessageReader(PointerActionMessage);

  // get only last message
  const message = pointerActionReader.read().pop();
  if (!message) return;

  const { camera, scene, raycast, raycastResult } = rendererData;

  const x = (message.mouseX / window.innerWidth) * 2 - 1;
  const y = -(message.mouseY / window.innerHeight) * 2 + 1;

  const coords = new Vector2(x, y);

  raycastResult.length = 0;
  raycast.setFromCamera(coords, camera);
  raycast.intersectObjects(scene.children, true).forEach((hit) => {
    if (hit.object instanceof Mesh) {
      raycastResult.push(parseInt(hit.object.name));
    }
  });
};
