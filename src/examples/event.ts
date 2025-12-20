/**
 * Events Example
 *
 * Events allow decoupled communication between systems.
 * Each reader sees each event exactly once.
 */

import { World } from "../ecs/World";
import { event } from "../ecs/Registry";
import { Update } from "../ecs/Systems";
import type { EventReader } from "../ecs/Event";

// Define event types
const DamageEvent = event<{ target: number; amount: number }>();
const DeathEvent = event<{ entity: number }>();

// System that sends damage events
const combatSystem = (world: World) => {
  const writer = world.getEventWriter(DamageEvent);

  // Simulate combat
  writer.send({ target: 1, amount: 25 });
  writer.send({ target: 2, amount: 50 });
};

// System that reads damage and may send death events
// Important: store reader to track what's been read
let damageReader: EventReader<{ target: number; amount: number }> | null = null;

const healthSystem = (world: World) => {
  damageReader ??= world.getEventReader(DamageEvent);
  const deathWriter = world.getEventWriter(DeathEvent);

  for (const { target, amount } of damageReader.read()) {
    console.log(`Entity ${target} took ${amount} damage`);

    // Check if dead (simplified)
    if (amount >= 50) {
      deathWriter.send({ entity: target });
    }
  }
};

// System that handles deaths
let deathReader: EventReader<{ entity: number }> | null = null;

const deathSystem = (world: World) => {
  deathReader ??= world.getEventReader(DeathEvent);

  for (const { entity } of deathReader.read()) {
    console.log(`Entity ${entity} died!`);
  }
};

// Setup
export const eventExample = () => {
  const world = new World();

  world.addSystem(Update, combatSystem);
  world.addSystem(Update, healthSystem);
  world.addSystem(Update, deathSystem);

  world.init();
  world.update();
  // Output:
  // Entity 1 took 25 damage
  // Entity 2 took 50 damage
  // Entity 2 died!
};
