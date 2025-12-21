import type {
  WebGLRenderer,
  Scene,
  OrthographicCamera,
  Raycaster,
} from "three";
import type { OrbitControls } from "three/examples/jsm/Addons.js";
import { resource } from "@ecs/Registry";
import { Render, Startup, Update } from "@ecs/Systems";
import type { World } from "@ecs/World";
import { setupRenderer } from "./setup";
import { updateRenderer } from "./update";
import { meshAdded, meshRemoved, meshUpdated } from "./meshOperations";
import { cameraUpdate } from "./camera";
import { raycastUpdate } from "./raycast";

export interface RendererParams {
  container: HTMLElement;
  renderer: WebGLRenderer;
  camera: OrthographicCamera;
  controls: OrbitControls;
  scene: Scene;
  raycast: Raycaster;
  raycastResult: number[];
}

export const RendererData = resource((params: RendererParams) => ({
  container: params.container,
  renderer: params.renderer,
  camera: params.camera,
  controls: params.controls,
  scene: params.scene,
  raycast: params.raycast,
  raycastResult: params.raycastResult,
}));

export const rendererBundle = (world: World) => {
  world.addSystem(Startup, setupRenderer);
  world.addSystem(Update, [meshAdded, meshRemoved, meshUpdated]);
  world.addSystem(Update, cameraUpdate);
  world.addSystem(Update, raycastUpdate);
  world.addSystem(Render, updateRenderer);
};
