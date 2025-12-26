import { Entity, type World } from "@ecs/World";
import { CameraAnimation, MeshRef } from "./components";
import { RendererData } from "./renderer";
import { Box3, Vector2, Vector3 } from "three";
import { frustumSize } from "@game/renderer/setup.ts";
import { Time } from "@app/App.ts";
import { Pixel } from "@game/puzzle/pixel.ts";

export const cameraTransitionInit = (world: World) => {
  const query = world.queryAdded(Entity, MeshRef, Pixel);
  if (query.length === 0) return;

  const box = new Box3();
  const size = new Vector3();
  const center = new Vector3();

  for (const [_, meshRef] of query) {
    box.expandByObject(meshRef.mesh);
  }

  box.getSize(size);
  box.getCenter(center);

  const paddingPx = 20;

  // Calculate the ratio of usable viewport (excluding padding)
  const viewportScale = Math.min(
    (window.innerWidth - paddingPx * 2) / window.innerWidth,
    (window.innerHeight - paddingPx * 2) / window.innerHeight,
  );

  const aspect = window.innerWidth / window.innerHeight;
  const maxDim = Math.max(size.x, size.y);

  // Base zoom calculation
  let zoom =
    aspect > 1 ? frustumSize / maxDim : frustumSize / (maxDim / aspect);

  // Reduce zoom to account for padding
  zoom *= viewportScale;

  const targetPosition = new Vector2(center.x, center.y);

  world.spawn(
    CameraAnimation({ targetZoom: zoom, targetPosition, speed: 10.0 }),
  );
};

export const cameraUpdate = (world: World) => {
  const query = world.query(Entity, CameraAnimation);

  if (query.length > 1) {
    console.warn(
      "Multiple CameraAnimation components found. There should be only one at a time.",
    );
  }

  if (query.length === 0) {
    return;
  }

  const rendererData = world.getResource(RendererData);
  const time = world.getResource(Time);

  for (const [entity, cameraAnim] of query) {
    const { camera, controls } = rendererData;

    const zoomDiff = cameraAnim.targetZoom - camera.zoom;
    const positionDiff = new Vector2(
      cameraAnim.targetPosition.x - camera.position.x,
      cameraAnim.targetPosition.y - camera.position.y,
    );

    const zoomDone = Math.abs(zoomDiff) <= 0.0001;
    const positionDone = positionDiff.length() <= 0.0001;

    if (!zoomDone || !positionDone) {
      // Animate zoom
      if (!zoomDone) {
        camera.zoom += zoomDiff * cameraAnim.speed * time.delta;
        camera.updateProjectionMatrix();
      }

      // Animate position
      if (!positionDone) {
        camera.position.x += positionDiff.x * cameraAnim.speed * time.delta;
        camera.position.y += positionDiff.y * cameraAnim.speed * time.delta;
        controls.target.x += positionDiff.x * cameraAnim.speed * time.delta;
        controls.target.y += positionDiff.y * cameraAnim.speed * time.delta;
      }

      controls.enabled = false;
    } else {
      // Snap to final values
      camera.zoom = cameraAnim.targetZoom;
      camera.position.x = cameraAnim.targetPosition.x;
      camera.position.y = cameraAnim.targetPosition.y;
      controls.target.x = cameraAnim.targetPosition.x;
      controls.target.y = cameraAnim.targetPosition.y;

      controls.enabled = true;
      world.entity(entity).despawn();
    }
  }
};
