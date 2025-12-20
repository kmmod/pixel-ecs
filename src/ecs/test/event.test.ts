import { describe, it, expect, beforeEach } from "vitest";
import { World } from "../../ecs/World";
import { event } from "../../ecs/Registry";

const TestEvent = event<{ value: number }>();

describe("EventWriter", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("sends events to queue", () => {
    const writer = world.getEventWriter(TestEvent);
    const reader = world.getEventReader(TestEvent);

    writer.send({ value: 42 });

    expect(reader.read()).toEqual([{ value: 42 }]);
  });

  it("sends multiple events", () => {
    const writer = world.getEventWriter(TestEvent);
    const reader = world.getEventReader(TestEvent);

    writer.send({ value: 1 });
    writer.send({ value: 2 });
    writer.send({ value: 3 });

    expect(reader.read()).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }]);
  });
});

describe("EventReader", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("reads each event exactly once", () => {
    const writer = world.getEventWriter(TestEvent);
    const reader = world.getEventReader(TestEvent);

    writer.send({ value: 1 });

    expect(reader.read()).toEqual([{ value: 1 }]);
    expect(reader.read()).toEqual([]); // already consumed
  });

  it("multiple readers each see events once", () => {
    const writer = world.getEventWriter(TestEvent);
    const readerA = world.getEventReader(TestEvent);
    const readerB = world.getEventReader(TestEvent);

    writer.send({ value: 42 });

    expect(readerA.read()).toEqual([{ value: 42 }]);
    expect(readerB.read()).toEqual([{ value: 42 }]);

    // Both consumed their copy
    expect(readerA.read()).toEqual([]);
    expect(readerB.read()).toEqual([]);
  });

  it("tracks unread state correctly", () => {
    const writer = world.getEventWriter(TestEvent);
    const reader = world.getEventReader(TestEvent);

    expect(reader.isEmpty()).toBe(true);
    expect(reader.hasUnread()).toBe(false);

    writer.send({ value: 1 });

    expect(reader.isEmpty()).toBe(false);
    expect(reader.hasUnread()).toBe(true);
    expect(reader.len()).toBe(1);

    reader.read();

    expect(reader.isEmpty()).toBe(true);
  });

  it("reset allows re-reading current events", () => {
    const writer = world.getEventWriter(TestEvent);
    const reader = world.getEventReader(TestEvent);

    writer.send({ value: 1 });
    reader.read();

    reader.reset();

    expect(reader.read()).toEqual([{ value: 1 }]);
  });
});

describe("Event lifecycle", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("events persist for 2 frames", () => {
    const writer = world.getEventWriter(TestEvent);
    const reader = world.getEventReader(TestEvent);

    writer.send({ value: 1 });
    world.update(); // frame 1

    // Still available (within 2 frames)
    reader.reset();
    expect(reader.read()).toEqual([{ value: 1 }]);

    world.update(); // frame 2

    // Expired after 2 frames
    reader.reset();
    expect(reader.read()).toEqual([]);
  });

  it("reader sees events sent after creation", () => {
    const reader = world.getEventReader(TestEvent);
    const writer = world.getEventWriter(TestEvent);

    writer.send({ value: 1 });

    expect(reader.read()).toEqual([{ value: 1 }]);
  });

  it("new reader does not see already-read events from before its creation", () => {
    const writer = world.getEventWriter(TestEvent);

    writer.send({ value: 1 });

    // Create reader after event was sent
    const reader = world.getEventReader(TestEvent);

    // Should see existing events (they're still in the queue)
    expect(reader.read()).toEqual([{ value: 1 }]);
  });

  it("handles interleaved reads and writes", () => {
    const writer = world.getEventWriter(TestEvent);
    const reader = world.getEventReader(TestEvent);

    writer.send({ value: 1 });
    expect(reader.read()).toEqual([{ value: 1 }]);

    writer.send({ value: 2 });
    expect(reader.read()).toEqual([{ value: 2 }]);

    writer.send({ value: 3 });
    writer.send({ value: 4 });
    expect(reader.read()).toEqual([{ value: 3 }, { value: 4 }]);
  });
});
