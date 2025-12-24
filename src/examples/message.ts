/**
 * Messages Example
 *
 * Messages allow decoupled communication between systems.
 * Each reader sees each message exactly once.
 */

import { World } from "@ecs/World";
import { message } from "@ecs/Registry";
import { Update } from "@ecs/Systems";
import type { MessageReader } from "@ecs/Message";

// Define message types
const DamageMessage = message<{ target: number; amount: number }>();
const DeathMessage = message<{ entity: number }>();

// System that writes damage messages
const combatSystem = (world: World) => {
  const writer = world.getMessageWriter(DamageMessage);

  // Simulate combat
  writer.write({ target: 1, amount: 25 });
  writer.write({ target: 2, amount: 50 });
};

// System that reads damage and may writes death messages
// Important: store reader to track what's been read
let damageReader: MessageReader<{ target: number; amount: number }> | null =
  null;

const healthSystem = (world: World) => {
  damageReader ??= world.getMessageReader(DamageMessage);
  const deathWriter = world.getMessageWriter(DeathMessage);

  for (const { target, amount } of damageReader.read()) {
    console.log(`Entity ${target} took ${amount} damage`);

    // Check if dead (simplified)
    if (amount >= 50) {
      deathWriter.write({ entity: target });
    }
  }
};

// System that handles deaths
let deathReader: MessageReader<{ entity: number }> | null = null;

const deathSystem = (world: World) => {
  deathReader ??= world.getMessageReader(DeathMessage);

  for (const { entity } of deathReader.read()) {
    console.log(`Entity ${entity} died!`);
  }
};

// Setup
export const messageExample = () => {
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
