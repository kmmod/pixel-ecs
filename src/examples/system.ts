/**
 * Systems & Run Conditions Example
 *
 * Systems are functions that run each frame.
 * Run conditions control when systems execute.
 */

import { World } from "@ecs/World";
import { resource } from "@ecs/Registry";
import { Startup, PreUpdate, Update, PostUpdate, Render } from "@ecs/Systems";

// Resources for conditions
const GamePaused = resource(() => ({ value: false }));
const DebugMode = resource(() => ({ enabled: false }));

// Startup system - runs once
const initSystem = (_: World) => {
  console.log("Game initialized");
};

// PreUpdate - runs before main update
const inputSystem = (_: World) => {
  console.log("Reading input...");
};

// Update - main game logic
const physicsSystem = (_: World) => {
  console.log("Running physics...");
};

const aiSystem = (_: World) => {
  console.log("Running AI...");
};

// PostUpdate - after main update
const collisionSystem = (_: World) => {
  console.log("Checking collisions...");
};

// Render - last stage
const renderSystem = (_: World) => {
  console.log("Rendering...");
};

// Debug system - only runs when debug enabled
const debugSystem = (_: World) => {
  console.log("Debug: entity count, FPS, etc.");
};

// Run condition helpers
const isNotPaused = (world: World) => {
  return !world.getResource(GamePaused)?.value;
};

const isDebugEnabled = (world: World) => {
  return world.getResource(DebugMode)?.enabled ?? false;
};

// Setup
export const systemExample = () => {
  const world = new World();

  // Insert resources
  world.insertResource(GamePaused());
  world.insertResource(DebugMode());

  // Register systems by stage
  world.addSystem(Startup, initSystem);
  world.addSystem(PreUpdate, inputSystem);

  // Multiple systems in same stage (run in order)
  world.addSystem(Update, [physicsSystem, aiSystem]);

  world.addSystem(PostUpdate, collisionSystem);
  world.addSystem(Render, renderSystem);

  // Conditional systems
  world.addSystem(Update, physicsSystem, {
    when: [isNotPaused],
  });

  // Multiple conditions (all must pass)
  world.addSystem(Update, debugSystem, {
    when: [isNotPaused, isDebugEnabled],
  });

  // Run
  world.init(); // runs Startup
  world.update(); // runs PreUpdate -> Update -> PostUpdate -> Render

  // Pause game
  world.getResource(GamePaused)!.value = true;
  world.update(); // physics skipped, debug skipped
};
