/**
 * Event queue that holds events with unique IDs.
 * Events auto-expire after 2 frames.
 */
export class EventQueue<T> {
  private events: { data: T; id: number; frame: number }[] = [];
  private currentFrame = 0;
  private nextId = 0;

  public send(event: T): void {
    this.events.push({
      data: event,
      id: this.nextId++,
      frame: this.currentFrame,
    });
  }

  /**
   * Get all non-expired events (internal use).
   */
  public iter(): { data: T; id: number }[] {
    return this.events.map((e) => ({ data: e.data, id: e.id }));
  }

  public clear(): void {
    this.events = [];
  }

  public nextFrame(): void {
    this.currentFrame++;
    // Remove old events (older than 2 frames)
    this.events = this.events.filter((e) => this.currentFrame - e.frame < 2);
  }

  public isEmpty(): boolean {
    return this.events.length === 0;
  }

  public len(): number {
    return this.events.length;
  }

  /**
   * Get the current oldest event ID (for initializing new readers).
   */
  public getOldestId(): number {
    return this.events.length > 0 ? this.events[0].id : this.nextId;
  }
}

/**
 * Stateless writer - sends events to the queue.
 *
 * @example
 * ```ts
 * const DamageEvent = event<{ target: number; amount: number }>();
 *
 * const combatSystem = (world: World) => {
 *   const writer = world.getEventWriter(DamageEvent);
 *   writer.send({ target: enemyId, amount: 25 });
 * };
 * ```
 */
export class EventWriter<T> {
  private queue: EventQueue<T>;

  constructor(queue: EventQueue<T>) {
    this.queue = queue;
  }

  /**
   * Send an event to be read by listeners.
   * The event will be available for 2 frames.
   */
  public send(event: T): void {
    this.queue.send(event);
  }
}

/**
 * Cursor-based reader - each reader tracks its own position.
 * Calling `read()` returns only events since last read and advances the cursor.
 * This ensures each reader sees each event exactly once.
 *
 * **Important:** Store and reuse the reader instance across frames.
 * Creating a new reader each frame will miss events.
 *
 * @example
 * ```ts
 * const DamageEvent = event<{ target: number; amount: number }>();
 *
 * // Store reader outside the system (or in a resource)
 * let damageReader: EventReader<{ target: number; amount: number }> | null = null;
 *
 * const healthSystem = (world: World) => {
 *   // Get or create reader (reuse across frames)
 *   if (!damageReader) {
 *     damageReader = world.getEventReader(DamageEvent);
 *   }
 *
 *   for (const event of damageReader.read()) {
 *     const health = world.entity(event.target).getMut(Health);
 *     if (health) health.current -= event.amount;
 *   }
 * };
 * ```
 */
export class EventReader<T> {
  private queue: EventQueue<T>;
  private lastReadId: number;

  constructor(queue: EventQueue<T>) {
    this.queue = queue;
    // Start at oldest available event so we don't miss any
    this.lastReadId = queue.getOldestId();
  }

  /**
   * Read all events since last read and advance the cursor.
   * Each event is returned exactly once per reader.
   */
  public read(): T[] {
    const events = this.queue.iter();
    const unread = events.filter((e) => e.id >= this.lastReadId);

    if (unread.length > 0) {
      // Advance cursor past the last read event
      this.lastReadId = unread[unread.length - 1].id + 1;
    }

    return unread.map((e) => e.data);
  }

  /**
   * Check if there are unread events without consuming them.
   */
  public hasUnread(): boolean {
    return this.queue.iter().some((e) => e.id >= this.lastReadId);
  }

  /**
   * Count of unread events.
   */
  public len(): number {
    return this.queue.iter().filter((e) => e.id >= this.lastReadId).length;
  }

  /**
   * Check if there are no unread events.
   */
  public isEmpty(): boolean {
    return !this.hasUnread();
  }

  /**
   * Clear the read history, allowing all current events to be read again.
   */
  public reset(): void {
    this.lastReadId = this.queue.getOldestId();
  }
}
