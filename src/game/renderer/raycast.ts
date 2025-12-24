import type { World } from "@ecs/World";
import { RendererData } from "./renderer";
import { Mesh, Vector2 } from "three";
import type { MessageReader } from "@ecs/Message";
import {
  PointerMoveMessage,
  type PointerMoveMessageProps,
} from "@game/input/input";

let pointerMoveReader: MessageReader<PointerMoveMessageProps> | null = null;
export const raycastUpdate = (world: World) => {
  const rendererData = world.getResource(RendererData);
  pointerMoveReader ??= world.getMessageReader(PointerMoveMessage);

  // get only last message
  const message = pointerMoveReader.read().pop();
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
