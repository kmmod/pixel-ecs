import type { World } from "@ecs/World.ts";
import { Startup } from "@ecs/Systems.ts";
import { initConfig } from "@game/globals/config.ts";

export const globalsBundle = (world: World) => {
  world.addSystem(Startup, initConfig);
};
