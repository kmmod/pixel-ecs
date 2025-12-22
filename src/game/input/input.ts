import type { World } from "@ecs/World";
import { event } from "@ecs/Registry";
import { Startup } from "@ecs/Systems";

export const PointerButton = {
  Left: "left",
  Middle: "middle",
  Right: "right",
} as const;

export const PointerAction = {
  Up: "up",
  Down: "down",
} as const;

export interface PointerActionEventProps {
  pointerAction: string;
  pointerButton: string;
}

export const PointerActionEvent = event<PointerActionEventProps>();

export interface PointerMoveEventProps {
  mouseX: number;
  mouseY: number;
}
export const PointerMoveEvent = event<PointerMoveEventProps>();

const setupEventListeners = (world: World) => {
  window.addEventListener("mousemove", (e) => {
    const writer = world.getEventWriter(PointerMoveEvent);
    writer.send({ mouseX: e.offsetX, mouseY: e.offsetY });
  });

  window.addEventListener("mousedown", (e) => {
    const writer = world.getEventWriter(PointerActionEvent);
    const button = getButton(e);
    writer.send({ pointerAction: PointerAction.Down, pointerButton: button });
  });
};

const getButton = (e: MouseEvent): string => {
  switch (e.button) {
    case 0:
      return PointerButton.Left;
    case 1:
      return PointerButton.Middle;
    case 2:
      return PointerButton.Right;
    default:
      return PointerButton.Left;
  }
};

export const inputBundle = (world: World) => {
  world.addSystem(Startup, setupEventListeners);
};
