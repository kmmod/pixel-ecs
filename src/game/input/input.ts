import type { World } from "@ecs/World";
import { event } from "@ecs/Registry";
import { Startup } from "@ecs/Systems";

export interface InputEventProps {
  mouseX: number;
  mouseY: number;
}
export const InputEvent = event<InputEventProps>();

const setupEventListeners = (world: World) => {
  window.addEventListener("mousemove", (e) => {
    const writer = world.getEventWriter(InputEvent);
    writer.send({ mouseX: e.offsetX, mouseY: e.offsetY });
  });
};

export const inputBundle = (world: World) => {
  world.addSystem(Startup, setupEventListeners);
};
