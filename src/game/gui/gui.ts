import type { World } from "@ecs/World.ts";
import { Startup } from "@ecs/Systems.ts";
import { createSidePanel } from "@game/gui/components/sidePanel/sidePanel.ts";

const setupGUI = (world: World) => {
  createSidePanel(world);
};

export const guiBundle = (world: World) => {
  world.addSystem(Startup, setupGUI);
};
