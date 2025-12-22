import { Entity, type World } from "@ecs/World";
import { MeshRef } from "./components";
import { RendererData } from "./renderer";
import { Mesh } from "three";

export const meshAdded = (world: World) => {
  const renderData = world.getResource(RendererData);

  const query = world.queryAdded(Entity, MeshRef);
  const scene = renderData.scene;

  for (const [entity, meshRef] of query) {
    const mesh = meshRef.mesh;
    mesh.traverse((child) => {
      child.name = entity.toString();
    });
    scene.add(mesh);
  }
};

export const meshRemoved = (world: World) => {
  const renderData = world.getResource(RendererData);
  const query = world.queryRemoved(MeshRef);
  const scene = renderData.scene;

  for (const entity of query) {
    const obj = scene.getObjectByName(entity.toString());
    if (obj && obj instanceof Mesh) {
      disposeMesh(obj);
      scene.remove(obj);
      continue;
    }
    // If no mesh was found lookup InstancedMesh by its entity id stored on userData
  }
};

const disposeMesh = (mesh: Mesh) => {
  mesh.traverse((child) => {
    if (child instanceof Mesh) {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }
  });
};
