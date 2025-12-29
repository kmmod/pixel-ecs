import type { World } from "@ecs/World";
import { message } from "@ecs/Registry";
import { Startup } from "@ecs/Systems";
import { RendererData } from "@game/renderer/renderer.ts";

export const PointerButton = {
  None: "none",
  Left: "left",
  Middle: "middle",
  Right: "right",
} as const;

export const PointerAction = {
  None: "none",
  Up: "up",
  Down: "down",
} as const;

export interface PointerActionMessageProps {
  pointerAction: string;
  pointerButton: string;
  mouseX: number;
  mouseY: number;
}

export const PointerActionMessage = message<PointerActionMessageProps>();

const isRendererTarget = (world: World, e: MouseEvent) => {
  const { renderer } = world.getResource(RendererData);
  const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
  return (
    renderer.domElement === e.target &&
    (renderer.domElement === elementUnderCursor ||
      renderer.domElement.contains(elementUnderCursor))
  );
};

const setupEventListeners = (world: World) => {
  window.addEventListener("mousemove", (e) => {
    if (!isRendererTarget(world, e)) return;
    const writer = world.getMessageWriter(PointerActionMessage);
    writer.write({
      pointerAction: PointerAction.None,
      pointerButton: getButtons(e),
      mouseX: e.offsetX,
      mouseY: e.offsetY,
    });
  });

  window.addEventListener("mousedown", (e) => {
    if (!isRendererTarget(world, e)) return;
    const writer = world.getMessageWriter(PointerActionMessage);
    writer.write({
      pointerAction: PointerAction.Down,
      pointerButton: getButton(e),
      mouseX: e.offsetX,
      mouseY: e.offsetY,
    });
  });

  window.addEventListener("mouseup", (e) => {
    if (!isRendererTarget(world, e)) return;
    const writer = world.getMessageWriter(PointerActionMessage);
    writer.write({
      pointerAction: PointerAction.Up,
      pointerButton: getButton(e),
      mouseX: e.offsetX,
      mouseY: e.offsetY,
    });
  });
};

const getButtons = (e: MouseEvent): string => {
  switch (e.buttons) {
    case 1:
      return PointerButton.Left;
    case 2:
      return PointerButton.Right;
    case 4:
      return PointerButton.Middle;
    default:
      return PointerButton.None;
  }
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
      return PointerButton.None;
  }
};

export const inputBundle = (world: World) => {
  world.addSystem(Startup, setupEventListeners);
};
