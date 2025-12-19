import { register, type RegistryToken } from "./Registry";
import type { World } from "./World";

export type StageToken = RegistryToken<"stage">;

export type System = (world: World) => void;

export interface SystemOptions {
  when?: ((world: World) => boolean)[];
}

export interface SystemEntry {
  system: System;
  conditions: ((world: World) => boolean)[];
}

const stage = (): StageToken => register<"stage">();

// Built-in stages
export const Startup = stage();
export const PreUpdate = stage();
export const Update = stage();
export const PostUpdate = stage();
export const Render = stage();
