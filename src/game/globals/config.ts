import { resource } from "@ecs/Registry.ts";
import type { World } from "@ecs/World.ts";

export interface ConfigParams {
  skipTransparent: boolean;
}

export const Config = resource((params: ConfigParams) => params);

export const initConfig = (world: World) => {
  const params: ConfigParams = {
    skipTransparent: true,
  };
  world.insertResource(Config(params));
};
