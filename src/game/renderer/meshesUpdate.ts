import { Entity, type World } from "@ecs/World";
import { MeshComponent, Transform } from "./components";
import { RendererData } from "./renderer";
import { Mesh, Object3D } from "three";

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
    mesh.userData.entityId = entity;

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

  const query = world.queryRemoved(Entity, MeshComponent);
  const scene = renderData.scene;

  for (const entity of query) {
    let mesh: Mesh | null = null;

    scene.traverse((obj) => {
      if (mesh) return;

      if (
        obj instanceof Mesh &&
        obj.userData &&
        obj.userData.entityId === entity
      ) {
        mesh = obj;
      }
    });

    if (mesh) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => mat.dispose());
      } else {
        mesh.material.dispose();
      }

      scene.remove(mesh);
    }

    // scene.remove(mesh);
    // mesh.geometry.dispose();
    // if (Array.isArray(mesh.material)) {
    //   mesh.material.forEach((mat) => mat.dispose());
    // } else {
    //   mesh.material.dispose();
    // }
  }
};
