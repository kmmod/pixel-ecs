import { Entity, type World } from "@ecs/World";
import {
  MaterialData,
  MeshRef,
  Transform,
  type MaterialDataProps,
} from "./components";
import { RendererData } from "./renderer";
import { Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";

export const meshAdded = (world: World) => {
  const renderData = world.getResource(RendererData);

  const query = world.queryAdded(Entity, MeshRef, Transform);
  const scene = renderData.scene;

  for (const [entity, meshRef, t] of query) {
    const mesh = meshRef.mesh;
    if (mesh instanceof Mesh) {
      mesh.position.copy(t.position);
      mesh.rotation.copy(t.rotation);
      mesh.scale.copy(t.scale);
      mesh.name = entity.toString();

      scene.add(mesh);
    }
  }
};

export const transformUpdated = (world: World) => {
  const query = world.queryChanged(Entity, MeshRef, Transform);

  for (const [_, meshRef, t] of query) {
    const mesh = meshRef.mesh;
    if (mesh instanceof Mesh) {
      mesh.position.copy(t.position);
      mesh.rotation.copy(t.rotation);
      mesh.scale.copy(t.scale);
    }
  }
};

// TODO: adding material now happens when creating the mesh, so this may be redundant, and might conflict with setting texture
export const materialAdded = (world: World) => {
  const query = world.queryAdded(Entity, MeshRef, MaterialData);

  for (const [_, meshRef, matData] of query) {
    if (meshRef.mesh instanceof Mesh) {
      const material = meshRef.mesh.material;
      if (Array.isArray(material)) {
        material.forEach((mat) => updateMaterial(mat, matData));
      } else {
        updateMaterial(material, matData);
      }
    }
  }
};

export const materialUpdated = (world: World) => {
  const query = world.queryChanged(Entity, MeshRef, MaterialData);

  for (const [_, meshRef, matData] of query) {
    if (meshRef.mesh instanceof Mesh) {
      const material = meshRef.mesh.material;
      if (Array.isArray(material)) {
        material.forEach((mat) => updateMaterial(mat, matData));
      } else {
        updateMaterial(material, matData);
      }
    }
  }
};

const updateMaterial = (
  mat: MeshBasicMaterial | MeshStandardMaterial,
  matData: Required<MaterialDataProps>,
) => {
  mat.color.set(matData.color);
  mat.opacity = matData.opacity;
  mat.transparent = matData.opacity < 1;
  mat.needsUpdate = true;
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
  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((mat) => mat.dispose());
  } else {
    mesh.material.dispose();
  }
};
