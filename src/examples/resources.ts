/**
 * Resources Example
 *
 * Resources are global singleton data accessible from any system.
 * Use for time, input, configuration, assets, etc.
 */

import { World } from "../ecs/World";
import { resource } from "../ecs/Registry";
import { Update } from "../ecs/Systems";

// Define resources
const Time = resource(() => ({
  delta: 0,
  elapsed: 0,
}));

const Input = resource(() => ({
  keys: new Set<string>(),
  mouseX: 0,
  mouseY: 0,
}));

const Config = resource((difficulty: number, soundEnabled: boolean) => ({
  difficulty,
  soundEnabled,
}));

const Score = resource(() => ({
  current: 0,
  highScore: 0,
}));

// System using Time resource
const timerSystem = (world: World) => {
  const time = world.getResource(Time);
  if (!time) return;

  console.log(`Elapsed: ${time.elapsed.toFixed(2)}s`);
};

// System using Input resource
const inputSystem = (world: World) => {
  const input = world.getResource(Input);
  if (!input) return;

  if (input.keys.has("Space")) {
    console.log("Jump!");
  }
};

// System using Config resource
const difficultySystem = (world: World) => {
  const config = world.getResource(Config);
  if (!config) return;

  const spawnRate = 1 / config.difficulty;
  console.log(`Spawn rate: ${spawnRate}`);
};

// System modifying Score resource
const scoreSystem = (world: World) => {
  const score = world.getResource(Score);
  if (!score) return;

  score.current += 10;
  score.highScore = Math.max(score.highScore, score.current);
};

// Setup
export const resourceExample = () => {
  const world = new World();

  // Insert resources (can chain)
  world
    .insertResource(Time())
    .insertResource(Input())
    .insertResource(Config(2, true))
    .insertResource(Score());

  world.addSystem(Update, inputSystem);
  world.addSystem(Update, difficultySystem);
  world.addSystem(Update, timerSystem);
  world.addSystem(Update, scoreSystem);

  world.init();

  // Simulate time passing
  const time = world.getResource(Time)!;
  time.delta = 0.016;
  time.elapsed = 1.5;

  world.update();

  console.log(`Score: ${world.getResource(Score)!.current}`);
};
