import { Entity, type World } from "@ecs/World";
import { MeshComponent, Transform } from "./components";
import { RendererData } from "./renderer";

export const meshAdded = (world: World) => {
  const renderData = world.getResource(RendererData);
  if (!renderData) {
    console.warn("RendererData resource not found");
    return;
  }

  const query = world.queryAdded(Entity, MeshComponent, Transform);
  const scene = renderData.scene;

  for (const [_, mesh, t] of query) {
    mesh.position.set(t.position.x, t.position.y, t.position.z);
    mesh.rotation.set(t.rotation.x, t.rotation.y, t.rotation.z);
    mesh.scale.set(t.scale.x, t.scale.y, t.scale.z);
    scene.add(mesh);
  }
};
