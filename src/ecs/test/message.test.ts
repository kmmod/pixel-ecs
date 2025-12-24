import { describe, it, expect, beforeEach } from "vitest";
import { World } from "@ecs/World";
import { message } from "@ecs/Registry";

const TestMessage = message<{ value: number }>();

describe("MessageWriter", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("writes messages to queue", () => {
    const writer = world.getMessageWriter(TestMessage);
    const reader = world.getMessageReader(TestMessage);

    writer.write({ value: 42 });

    expect(reader.read()).toEqual([{ value: 42 }]);
  });

  it("writes multiple messages", () => {
    const writer = world.getMessageWriter(TestMessage);
    const reader = world.getMessageReader(TestMessage);

    writer.write({ value: 1 });
    writer.write({ value: 2 });
    writer.write({ value: 3 });

    expect(reader.read()).toEqual([{ value: 1 }, { value: 2 }, { value: 3 }]);
  });
});

describe("MessageReader", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("reads each message exactly once", () => {
    const writer = world.getMessageWriter(TestMessage);
    const reader = world.getMessageReader(TestMessage);

    writer.write({ value: 1 });

    expect(reader.read()).toEqual([{ value: 1 }]);
    expect(reader.read()).toEqual([]); // already consumed
  });

  it("multiple readers each see message once", () => {
    const writer = world.getMessageWriter(TestMessage);
    const readerA = world.getMessageReader(TestMessage);
    const readerB = world.getMessageReader(TestMessage);

    writer.write({ value: 42 });

    expect(readerA.read()).toEqual([{ value: 42 }]);
    expect(readerB.read()).toEqual([{ value: 42 }]);

    // Both consumed their copy
    expect(readerA.read()).toEqual([]);
    expect(readerB.read()).toEqual([]);
  });

  it("tracks unread state correctly", () => {
    const writer = world.getMessageWriter(TestMessage);
    const reader = world.getMessageReader(TestMessage);

    expect(reader.isEmpty()).toBe(true);
    expect(reader.hasUnread()).toBe(false);

    writer.write({ value: 1 });

    expect(reader.isEmpty()).toBe(false);
    expect(reader.hasUnread()).toBe(true);
    expect(reader.len()).toBe(1);

    reader.read();

    expect(reader.isEmpty()).toBe(true);
  });

  it("reset allows re-reading current messages", () => {
    const writer = world.getMessageWriter(TestMessage);
    const reader = world.getMessageReader(TestMessage);

    writer.write({ value: 1 });
    reader.read();

    reader.reset();

    expect(reader.read()).toEqual([{ value: 1 }]);
  });
});

describe("Message lifecycle", () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  it("message persist for 2 frames", () => {
    const writer = world.getMessageWriter(TestMessage);
    const reader = world.getMessageReader(TestMessage);

    writer.write({ value: 1 });
    world.update(); // frame 1

    // Still available (within 2 frames)
    reader.reset();
    expect(reader.read()).toEqual([{ value: 1 }]);

    world.update(); // frame 2

    // Expired after 2 frames
    reader.reset();
    expect(reader.read()).toEqual([]);
  });

  it("reader sees message sent after creation", () => {
    const reader = world.getMessageReader(TestMessage);
    const writer = world.getMessageWriter(TestMessage);

    writer.write({ value: 1 });

    expect(reader.read()).toEqual([{ value: 1 }]);
  });

  it("new reader does not see already-read messages from before its creation", () => {
    const writer = world.getMessageWriter(TestMessage);

    writer.write({ value: 1 });

    // Create reader after message was sent
    const reader = world.getMessageReader(TestMessage);

    // Should see existing messages (they're still in the queue)
    expect(reader.read()).toEqual([{ value: 1 }]);
  });

  it("handles interleaved reads and writes", () => {
    const writer = world.getMessageWriter(TestMessage);
    const reader = world.getMessageReader(TestMessage);

    writer.write({ value: 1 });
    expect(reader.read()).toEqual([{ value: 1 }]);

    writer.write({ value: 2 });
    expect(reader.read()).toEqual([{ value: 2 }]);

    writer.write({ value: 3 });
    writer.write({ value: 4 });
    expect(reader.read()).toEqual([{ value: 3 }, { value: 4 }]);
  });
});
