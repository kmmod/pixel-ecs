import { register, type RegistryToken } from "./Registry";
import type { World } from "./World";

export type StageToken = RegistryToken<"stage">;

const stage = (): StageToken => register<"stage">();

// Built-in stages
export const Startup = stage();
export const PreUpdate = stage();
export const Update = stage();
export const PostUpdate = stage();
export const Render = stage();

export type System = (world: World) => void;
