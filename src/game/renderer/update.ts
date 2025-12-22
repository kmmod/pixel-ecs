import type { World } from "@ecs/World";
import { RendererData } from "./renderer";

export const updateRenderer = (world: World) => {
  const rendererData = world.getResource(RendererData);
  rendererData.controls.update();
  rendererData.renderer.render(rendererData.scene, rendererData.camera);
};
