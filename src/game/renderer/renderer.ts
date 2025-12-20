import type { WebGLRenderer, Scene, OrthographicCamera } from "three";
import type { OrbitControls } from "three/examples/jsm/Addons.js";
import { resource } from "@ecs/Registry";
import { Render, Startup, Update } from "@ecs/Systems";
import type { World } from "@ecs/World";
import { setupRenderer } from "./setup";
import { updateRenderer } from "./update";
import { meshAdded } from "./meshesUpdate";

export interface RendererParams {
  container: HTMLElement;
  renderer: WebGLRenderer;
  camera: OrthographicCamera;
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

export const rendererBundle = (world: World) => {
  world.addSystem(Startup, setupRenderer);
  // world.addSystem(Update, addMeshesTimer);
  // world.addSystem(Update, addMeshes);
  world.addSystem(Update, meshAdded);
  world.addSystem(Render, updateRenderer);
};
