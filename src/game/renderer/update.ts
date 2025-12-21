import type { World } from "@ecs/World";
import { RendererData } from "./renderer";

export const updateRenderer = (world: World) => {
  const rendererData = world.getResource(RendererData);
  if (!rendererData) {
    console.warn("RendererData resource not found");
    return;
  }

  rendererData.controls.update();
  rendererData.renderer.render(rendererData.scene, rendererData.camera);
};
