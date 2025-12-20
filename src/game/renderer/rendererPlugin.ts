import type { WebGLRenderer, PerspectiveCamera, Scene } from "three";
import type { OrbitControls } from "three/examples/jsm/Addons.js";
import { resource } from "../../ecs/Registry";
import { Startup, Update } from "../../ecs/Systems";
import type { World } from "../../ecs/World";
import { setupRenderer } from "./setup";
import { updateRenderer } from "./update";

export interface RendererParams {
  container: HTMLElement;
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  scene: Scene;
}

export const RendererData = resource((params: RendererParams) => ({
  container: params.container,
  renderer: params.renderer,
  camera: params.camera,
  controls: params.controls,
  scene: params.scene,
}));

export const rendererPlugin = (world: World) => {
  world.addSystem(Startup, setupRenderer);
  world.addSystem(Update, updateRenderer);
};
