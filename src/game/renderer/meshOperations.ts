import { Entity, type World } from "@ecs/World";
import { MeshComponent, Transform } from "./components";
import { RendererData } from "./renderer";
import { Mesh } from "three";

export const meshAdded = (world: World) => {
  const renderData = world.getResource(RendererData);
  if (!renderData) {
    console.warn("RendererData resource not found");
    return;
  }

  const query = world.queryAdded(Entity, MeshComponent, Transform);
  const scene = renderData.scene;

  for (const [entity, mesh, t] of query) {
    mesh.position.set(t.position.x, t.position.y, t.position.z);
    mesh.rotation.set(t.rotation.x, t.rotation.y, t.rotation.z);
    mesh.scale.set(t.scale.x, t.scale.y, t.scale.z);
    mesh.name = entity.toString();

    scene.add(mesh);
  }
};

export const meshUpdated = (world: World) => {
  const query = world.queryChanged(Entity, MeshComponent, Transform);

  for (const [_, mesh, t] of query) {
    mesh.position.set(t.position.x, t.position.y, t.position.z);
    mesh.rotation.set(t.rotation.x, t.rotation.y, t.rotation.z);
    mesh.scale.set(t.scale.x, t.scale.y, t.scale.z);
  }
};

export const meshRemoved = (world: World) => {
  const renderData = world.getResource(RendererData);
  if (!renderData) {
    console.warn("RendererData resource not found");
    return;
  }

  const query = world.queryRemoved(MeshComponent);
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
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((mat) => mat.dispose());
  } else {
    mesh.material.dispose();
  }
};
