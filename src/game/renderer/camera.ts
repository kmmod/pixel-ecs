import { Entity, type World } from "@ecs/World";
import { CameraAnimation } from "./components";
import { RendererData } from "./renderer";

export const cameraUpdate = (world: World) => {
  const rendererData = world.getResource(RendererData);
  if (!rendererData) {
    return;
  }

  const query = world.query(Entity, CameraAnimation);

  if (query.length > 1) {
    console.warn(
      "Multiple CameraAnimation components found. There should be only one at a time.",
    );
  }

  for (const [entity, cameraAnim] of query) {
    const camera = rendererData.camera;
    const controls = rendererData.controls;
    const diff = cameraAnim.targetZoom - camera.zoom;
    if (Math.abs(diff) > 0.001) {
      camera.zoom += diff * cameraAnim.speed;
      camera.updateProjectionMatrix();
      controls.enableZoom = false;
    } else {
      camera.zoom = cameraAnim.targetZoom;
      controls.enableZoom = true;
      world.entity(entity).despawn();
    }
  }
};
