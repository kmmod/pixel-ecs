import { component } from "./core/Component";
import { PostUpdate, Startup, Update } from "./core/Systems";
import { Entity, Time, World } from "./core/World";

// Define the main application class

export class App {
  constructor() {
    const world = new World();

    world.addSystem(Startup, setupSystem);
    world.addSystem(Update, movementSystem);
    world.addSystem(Update, removeSystem);
    world.addSystem(PostUpdate, logSystem);

    world.init();
    world.run();

    setTimeout(() => {
      world.stop();
      console.log("Stopping to prevent log overflow");
    }, 5000);
  }
}

// Create some components

type Velocity = {
  dx: number;
  dy: number;
};

const Velocity = component<Velocity>((dx: number = 0, dy: number = 0) => ({
  dx,
  dy,
}));

type Transform = {
  x: number;
  y: number;
};

const Transform = component<Transform>((x: number = 0, y: number = 0) => ({
  x,
  y,
}));

type Display = {
  color: string;
  shape: string;
};

const Display = component<Display>((props: Partial<Display> = {}) => ({
  color: "white",
  shape: "circle",
  ...props,
}));

// Create systems

// Setup initial entities and properties
const setupSystem = (world: World) => {
  console.log("Setting up the game");

  // Add entities
  const displayProps: Display = {
    color: "red",
    shape: "square",
  };

  world.spawn(Velocity(15, 5), Transform(0, 0));
  world.spawn(Velocity(5, 6), Transform(10, 10), Display());
  world.spawn(Transform(), Display(displayProps));
};

// Move entities based on their velocity
const movementSystem = (world: World) => {
  const time = world.getRes(Time);
  if (!time) return;

  const query = world.query(Transform, Velocity);

  for (const [transform, velocity] of query) {
    transform.x += velocity.dx * time.delta;
    transform.y += velocity.dy * time.delta;
  }
};

// Remove all entities with Transform and Display after 2 seconds
const removeSystem = (world: World) => {
  const time = world.getRes(Time);
  const query = world.query(Entity, Transform, Display);

  if (time && time.elapsed < 2) {
    return;
  }

  for (const [entity] of query) {
    console.log("Removing all entitieees with Transform and display!");
    world.entity(entity).despawn();
  }
};

// Log entity positions and velocities
const logSystem = (world: World) => {
  const query = world.query(Entity, Transform, Velocity);

  for (const [entity, transform, velocity] of query) {
    console.log(
      `Entity ${entity} - Position: (${transform.x.toFixed(2)}, ${transform.y.toFixed(2)}) Velocity: (${velocity.dx}, ${velocity.dy})`,
    );
  }
};
