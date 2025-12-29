# PixelECS

A lightweight, TypeScript-first Entity Component System (ECS) framework designed for games and interactive applications. Built as a toy project to explore ECS patterns with a focus on ergonomics and type safety.

## Features

- **Archetype-based storage** for cache-friendly iteration
- **Type-safe components, resources, and messages** via TypeScript generics
- **Change detection** with `queryAdded`, `queryChanged`, and `queryRemoved`
- **State machines** with `OnEnter`/`OnExit` lifecycle hooks
- **Message passing** for decoupled system communication
- **Run conditions** for conditional system execution
- **Built-in system stages**: Startup, PreUpdate, Update, PostUpdate, Render

## Quick Start

```ts
import { World, Entity } from "@ecs/World";
import { component, resource } from "@ecs/Registry";
import { Update } from "@ecs/Systems";

// Define components
const Position = component((x: number, y: number) => ({ x, y }));
const Velocity = component((x: number, y: number) => ({ x, y }));

// Define a resource
const Time = resource(() => ({ delta: 0 }));

// Create a system
const movementSystem = (world: World) => {
  const time = world.getResource(Time);
  
  for (const [pos, vel] of world.queryMut(Position, Velocity)) {
    pos.x += vel.x * time.delta;
    pos.y += vel.y * time.delta;
  }
};

// Set up the world
const world = new World();
world.insertResource(Time());
world.addSystem(Update, movementSystem);

// Spawn entities
world.spawn(Position(0, 0), Velocity(10, 5));
world.spawn(Position(100, 50), Velocity(-5, 2));

// Run the game loop
world.init();
function loop() {
  world.getResource(Time).delta = 0.016;
  world.update();
  requestAnimationFrame(loop);
}
loop();
```

## Installation

```bash
pnpm install
pnpm run dev
```

## Core Concepts

### World

The `World` is the container for all entities, components, resources, and systems.

```ts
const world = new World();
```

### Components

Components are pure data attached to entities. Define them with factory functions:

```ts
const Health = component((current: number, max: number) => ({ current, max }));
const Position = component((x: number, y: number) => ({ x, y }));
const Enemy = component(() => ({})); // Tag component (no data)
```

### Entities

Entities are just IDs. Spawn them with components:

```ts
// Spawn with components
const player = world.spawn(
  Position(0, 0),
  Health(100, 100)
);

// Batch spawn for efficiency
const enemies = world.spawnBatch(100, () => [
  Position(Math.random() * 800, Math.random() * 600),
  Enemy()
]);
```

### Entity Operations

Access and modify entities through the fluent API:

```ts
const entity = world.entity(playerId);

// Read component
const pos = entity.get(Position);

// Mutate component (marks as changed)
const health = entity.getMut(Health);
health.current -= 10;

// Check components
if (entity.has(Enemy, Health)) { /* ... */ }

// Add/update components
entity.insert(Shield(50));

// Remove components
entity.remove(Shield);

// Despawn (deferred until end of frame)
entity.despawn();
```

### Systems

Systems are functions that operate on the world. Register them to stages:

```ts
const physicsSystem = (world: World) => {
  for (const [pos, vel] of world.queryMut(Position, Velocity)) {
    pos.x += vel.x;
    pos.y += vel.y;
  }
};

// Register to Update stage
world.addSystem(Update, physicsSystem);

// Register multiple systems
world.addSystem(Update, [physicsSystem, collisionSystem]);

// Conditional execution
world.addSystem(Update, aiSystem, {
  when: [(w) => !w.getResource(GamePaused).value]
});
```

### Stages

Built-in execution order:

1. **Startup** — Runs once on `world.init()`
2. **PreUpdate** — Before main update
3. **Update** — Main game logic
4. **PostUpdate** — After main update
5. **Render** — Rendering

### Queries

Retrieve entities with specific components:

```ts
// Basic query (read-only)
for (const [pos, vel] of world.query(Position, Velocity)) {
  console.log(pos.x, pos.y);
}

// With entity ID
for (const [entity, pos] of world.query(Entity, Position)) {
  console.log(`Entity ${entity} at ${pos.x}, ${pos.y}`);
}

// Mutation query (marks components as changed)
for (const [pos] of world.queryMut(Position)) {
  pos.x += 1;
}

// Exclude components
import { Without } from "@ecs/Query";
for (const [entity, pos] of world.query(Entity, Position, Without(Enemy))) {
  // Only non-enemy entities
}
```

### Change Detection

React to component changes:

```ts
// Newly added components (last frame)
for (const [entity, pos] of world.queryAdded(Entity, Position)) {
  console.log(`New position on entity ${entity}`);
}

// Modified components (via getMut or queryMut)
for (const [entity, pos] of world.queryChanged(Entity, Position)) {
  updateSpatialIndex(entity, pos);
}

// Removed components
for (const entity of world.queryRemoved(Health)) {
  console.log(`Entity ${entity} lost Health`);
}
```

### Resources

Global singleton data accessible from any system:

```ts
const Time = resource(() => ({ delta: 0, elapsed: 0 }));
const Config = resource((difficulty: number) => ({ difficulty }));

// Insert
world.insertResource(Time());
world.insertResource(Config(2));

// Access
const time = world.getResource(Time);
time.delta = 0.016;

// Optional access (returns undefined if missing)
const config = world.tryGetResource(Config);

// Remove
world.removeResource(Config);
```

### Messages

Decoupled communication between systems:

```ts
const DamageEvent = message<{ target: number; amount: number }>();

// Writer (in combat system)
const writer = world.getMessageWriter(DamageEvent);
writer.write({ target: enemyId, amount: 25 });

// Reader (in health system) - store and reuse!
let damageReader: MessageReader<...> | null = null;

const healthSystem = (world: World) => {
  damageReader ??= world.getMessageReader(DamageEvent);
  
  for (const { target, amount } of damageReader.read()) {
    const health = world.entity(target).getMut(Health);
    if (health) health.current -= amount;
  }
};
```

Messages persist for 2 frames, allowing multiple systems to read them.

### State Machines

Control game flow with states:

```ts
import { state, OnEnter, OnExit } from "@ecs/State";

const GameStates = {
  Menu: "menu",
  Playing: "playing",
  Paused: "paused",
} as const;

const GameState = state(GameStates, GameStates.Menu);

// Register state
world.insertState(GameState);

// Transition hooks
world.addSystem(OnEnter(GameState.Playing), spawnPlayerSystem);
world.addSystem(OnExit(GameState.Playing), cleanupSystem);

// Transition
world.setState(GameState.Playing);

// Query current state
const current = world.getState(GameState); // "menu" | "playing" | "paused"
```

## Sample Project: Pixel Puzzle Game

The repository includes a complete puzzle game built with PixelECS and Three.js. Players solve nonogram-style puzzles by marking pixels based on coordinate clues.

### Game Architecture

```
src/game/
├── Game.ts              # Main game setup, bundles all systems
├── globals/             # Global configuration resources
├── gui/                 # UI components (side panel)
├── input/               # Mouse/keyboard input handling
├── puzzle/              # Core puzzle logic
│   ├── pixel.ts         # Pixel and Coordinate components
│   ├── generate/        # Puzzle generation from images
│   ├── hover.ts         # Hover effects
│   ├── select.ts        # Pixel selection
│   ├── solve.ts         # Auto-solve functionality
│   └── visibility.ts    # Coordinate visibility based on zoom
└── renderer/            # Three.js rendering
    ├── camera.ts        # Camera animation
    ├── components.ts    # Mesh components
    ├── meshOperations.ts # Add/remove meshes from scene
    └── raycast.ts       # Mouse picking
```

### Bundle Pattern

Systems are organized into "bundles" that register related systems together:

```ts
// puzzle/puzzle.ts
export const puzzleBundle = (world: World) => {
  world.addSystem(Startup, [initPuzzle, initVisibility]);
  world.addSystem(Update, [generatePuzzle, regeneratePuzzle]);
  world.addSystem(Update, [hoverPuzzle, hoverAnimate, hoverAnimation]);
  world.addSystem(Update, [selectPuzzle, handlePixelSelect]);
  world.addSystem(Update, [coordinateVisibility, scaleAnimation]);
};

// Game.ts
export class Game {
  constructor() {
    const world = new World();
    const app = new App(world);

    globalsBundle(world);
    inputBundle(world);
    guiBundle(world);
    puzzleBundle(world);
    rendererBundle(world);

    app.run();
  }
}
```

### Key Game Components

```ts
// Pixel data
const Pixel = component((props: PixelProps) => props);
interface PixelProps {
  cell: { x: number; y: number };
  color: string;
  value: number;    // 0 or 1
  marked: boolean;  // Player's mark
}

// Coordinate clues
const Coordinate = component((props: CoordinateProps) => props);
interface CoordinateProps {
  cell: { x: number; y: number };
  value: number;  // Sum of adjacent pixel values
  hidden: boolean;
}

// Three.js mesh reference
const MeshRef = component((props: { mesh: Mesh }) => props);

// Selectable marker
const Selectable = component(() => ({}));
```

### Message-Driven Events

```ts
// Trigger puzzle generation from image file
const FileMessage = message<{ file: string }>();
writer.write({ file: "sprite.png" });

// Pixel selection events
const PixelSelectMessage = message<{ entityId: number }>();

// Solve puzzle command
const SolveMessage = message<{}>();
```

## Project Structure

```
src/
├── app/
│   └── App.ts           # Game loop and Time resource
├── ecs/
│   ├── World.ts         # Core ECS world
│   ├── Registry.ts      # Component/resource/message factories
│   ├── Systems.ts       # System stages
│   ├── Query.ts         # Query filters (Without)
│   ├── State.ts         # State machine
│   ├── Message.ts       # Message queue
│   └── test/            # Unit tests
├── examples/            # Usage examples
│   ├── query.ts
│   ├── resources.ts
│   ├── message.ts
│   ├── state.ts
│   └── system.ts
├── game/                # Pixel puzzle game
└── main.ts              # Entry point
```

## Scripts

```bash
pnpm run dev            # Start development server
pnpm run build          # Build for production
pnpm run test           # Run tests
pnpm run test:verbose   # Run tests with detailed output
pnpm run test:coverage  # Generate coverage report
pnpm run fix            # Format code with Prettier
```

## Dependencies

- **three** — 3D rendering for the puzzle game
- **vite** — Build tool
- **vitest** — Testing framework
- **typescript** — Type safety

## License

MIT