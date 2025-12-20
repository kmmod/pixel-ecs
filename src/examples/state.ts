/**
 * State Machine Example
 *
 * States allow you to control game flow and run systems
 * only during specific states (menu, playing, paused, etc.)
 */

import { World } from "@ecs/World";
import { state, OnEnter, OnExit } from "@ecs/State";
import { Update } from "@ecs/Systems";

// Define available states
const GameStates = {
  Menu: "menu",
  Playing: "playing",
  Paused: "paused",
  GameOver: "gameover",
} as const;

// Create state token with initial state
const GameState = state(GameStates, GameStates.Menu);

// Systems that run on state transitions
const onEnterMenu = (_: World) => {
  console.log("Entered menu - showing UI");
};

const onExitMenu = (_: World) => {
  console.log("Left menu - hiding UI");
};

const onEnterPlaying = (_: World) => {
  console.log("Game started - spawning player");
};

const onEnterGameOver = (_: World) => {
  console.log("Game over - showing score");
};

// Conditional system - only runs while playing
const gameplaySystem = (_: World) => {
  console.log("Running gameplay logic...");
};

// Setup
export const stateExample = () => {
  const world = new World();

  // Register state
  world.insertState(GameState);

  // Add transition handlers
  world.addSystem(OnEnter(GameState.Menu), onEnterMenu);
  world.addSystem(OnExit(GameState.Menu), onExitMenu);
  world.addSystem(OnEnter(GameState.Playing), onEnterPlaying);
  world.addSystem(OnEnter(GameState.GameOver), onEnterGameOver);

  // Conditional system with run condition
  world.addSystem(Update, gameplaySystem, {
    when: [(w) => w.getState(GameState) === "playing"],
  });

  // Simulate game flow
  world.init();
  world.update(); // enters Menu

  world.setState(GameState.Playing);
  world.update(); // exits Menu, enters Playing, runs gameplay

  world.setState(GameState.GameOver);
  world.update(); // enters GameOver
};
