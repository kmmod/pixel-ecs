import { Time } from "../../app/App";
import type { World } from "../../ecs/World";
import { event } from "../../ecs/Registry";
import { RendererData } from "./rendererPlugin";
import type { EventReader } from "../../ecs/Event";

interface AddMeshesEvent {
  value: number;
}
const AddMeshes = event<AddMeshesEvent>();

export const updateRenderer = (world: World) => {
  const rendererData = world.getResource(RendererData);
  if (!rendererData) {
    console.warn("RendererData resource not found");
    return;
  }

  rendererData.controls.update();
  rendererData.renderer.render(rendererData.scene, rendererData.camera);
};

let timeMarker = 0;
export const addMeshesTimer = (world: World) => {
  const time = world.getResource(Time);
  if (!time) return;

  // Add meshes every 5 seconds
  if (time.elapsed > timeMarker) {
    timeMarker = Math.floor(time.elapsed) + 1;
    const writer = world.getEventWriter(AddMeshes);
    const randomCount = Math.floor(Math.random() * 5) + 1;
    writer.send({ value: randomCount });
    console.log("Wrote value:", randomCount);
  }
};

let addMeshesReader: EventReader<AddMeshesEvent> | null = null;
export const addMeshes = (world: World) => {
  addMeshesReader ??= world.getEventReader(AddMeshes);

  for (const event of addMeshesReader.read()) {
    console.log("Read value:", event.value);
  }
};
