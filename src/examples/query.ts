/**
 * Queries Example
 *
 * Queries retrieve entities with specific components.
 * Use queryMut when modifying, query for read-only access.
 */

import { World, Entity } from "../ecs/World";
import { component } from "../ecs/Registry";
import { Update } from "../ecs/Systems";

// Define components
const Position = component((x: number, y: number) => ({ x, y }));
const Velocity = component((x: number, y: number) => ({ x, y }));
const Health = component((current: number, max: number) => ({ current, max }));
const Enemy = component(() => ({}));

// Movement system - uses queryMut since we modify Position
const movementSystem = (world: World) => {
  for (const [pos, vel] of world.queryMut(Position, Velocity)) {
    pos.x += vel.x;
    pos.y += vel.y;
  }
};

// Read-only query - just logging, no modification
const debugSystem = (world: World) => {
  for (const [entity, pos] of world.query(Entity, Position)) {
    console.log(`Entity ${entity} at (${pos.x}, ${pos.y})`);
  }
};

// Query with change detection
const positionChangedSystem = (world: World) => {
  for (const [entity, pos] of world.queryChanged(Entity, Position)) {
    console.log(`Entity ${entity} moved to (${pos.x}, ${pos.y})`);
  }
};

// Query for newly added components
const onEnemySpawned = (world: World) => {
  for (const [entity] of world.queryAdded(Entity, Enemy)) {
    console.log(`New enemy spawned: ${entity}`);
  }
};

// Query for removed components
const onHealthRemoved = (world: World) => {
  for (const entity of world.queryRemoved(Health)) {
    console.log(`Entity ${entity} lost Health component`);
  }
};

// Setup
export const queryExample = () => {
  const world = new World();

  world.addSystem(Update, debugSystem);
  world.addSystem(Update, movementSystem);
  world.addSystem(Update, positionChangedSystem);
  world.addSystem(Update, onEnemySpawned);
  world.addSystem(Update, onHealthRemoved);

  // Register archetypes (optional, for optimization)
  world.registerArchetype(Position, Velocity);

  // Spawn entities
  world.spawn(Position(0, 0), Velocity(1, 0));
  world.spawn(Position(5, 5), Velocity(0, -1), Enemy());
  const id = world.spawn(Position(10, 10), Health(100, 100));

  world.init();
  world.update();
  // Output: New enemy spawned, positions changed

  world.entity(id).remove(Health);
  world.update();
  // Output: Entity lost Health component
};
