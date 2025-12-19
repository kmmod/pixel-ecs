// State.ts
import { TOKEN_ID } from "./Registry";
import { stageFor, type StageToken } from "./Systems";

let nextStateId = 0;

const TOKEN_NAME = Symbol("token_name");

declare const STATE_TYPE: unique symbol;

export interface StateToken<T extends string> {
  [TOKEN_ID]: number;
  [TOKEN_NAME]: string;
  [STATE_TYPE]?: T; // Phantom type - never set at runtime, just for TS
}

export interface StateValue<T extends string> {
  state: StateToken<T>;
  value: T;
}

type ConstObject = { readonly [key: string]: string };
type ValueOf<T> = T[keyof T];

/**
 * Define a state machine with named states.
 *
 * @param states - Object defining available states as const
 * @param initial - Initial state value
 * @returns State token with typed state values for use with OnEnter/OnExit
 *
 * @example
 * ```ts
 * const GameStates = {
 *   Menu: "menu",
 *   Running: "running",
 *   Paused: "paused",
 * } as const;
 *
 * const GameState = state(GameStates, GameStates.Menu);
 *
 * // Register with world
 * world.insertState(GameState);
 *
 * // Use in systems
 * world.addSystem(OnEnter(GameState.Running), spawnPlayerSystem);
 * world.addSystem(OnExit(GameState.Running), cleanupSystem);
 *
 * // Transition
 * world.setState(GameState.Running);
 *
 * // Query current state
 * const current = world.getState(GameState); // "menu" | "running" | "paused"
 * ```
 */
export function state<T extends ConstObject>(
  states: T,
  initial: ValueOf<T>,
): StateToken<ValueOf<T>> & { initial: ValueOf<T> } & {
  [K in keyof T]: StateValue<ValueOf<T>>;
} {
  // Generate unique name from values
  const name = Object.values(states).join(":");

  const token = {
    [TOKEN_ID]: nextStateId++,
    [TOKEN_NAME]: name,
    initial,
  } as StateToken<ValueOf<T>> & { initial: ValueOf<T> } & {
    [K in keyof T]: StateValue<ValueOf<T>>;
  };

  for (const key of Object.keys(states)) {
    (token as any)[key] = { state: token, value: states[key] };
  }

  return token;
}

export const OnEnter = <T extends string>(
  stateValue: StateValue<T>,
): StageToken => {
  const key = `OnEnter(${stateValue.state[TOKEN_NAME]}.${stateValue.value})`;
  return stageFor(key);
};

export const OnExit = <T extends string>(
  stateValue: StateValue<T>,
): StageToken => {
  const key = `OnExit(${stateValue.state[TOKEN_NAME]}.${stateValue.value})`;
  return stageFor(key);
};
