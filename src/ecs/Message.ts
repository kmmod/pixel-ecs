/**
 * Message queue that holds messages with unique IDs.
 * Messages auto-expire after 2 frames.
 */
export class MessageQueue<T> {
  private messages: { data: T; id: number; frame: number }[] = [];
  private currentFrame = 0;
  private nextId = 0;

  public write(message: T): void {
    this.messages.push({
      data: message,
      id: this.nextId++,
      frame: this.currentFrame,
    });
  }

  /**
   * Get all non-expired messages (internal use).
   */
  public iter(): { data: T; id: number }[] {
    return this.messages.map((e) => ({ data: e.data, id: e.id }));
  }

  public clear(): void {
    this.messages = [];
  }

  public nextFrame(): void {
    this.currentFrame++;
    // Remove old messages (older than 2 frames)
    this.messages = this.messages.filter(
      (e) => this.currentFrame - e.frame < 2,
    );
  }

  public isEmpty(): boolean {
    return this.messages.length === 0;
  }

  public len(): number {
    return this.messages.length;
  }

  /**
   * Get the current oldest messages ID (for initializing new readers).
   */
  public getOldestId(): number {
    return this.messages.length > 0 ? this.messages[0].id : this.nextId;
  }
}

/**
 * Stateless writer - writes messages to the queue.
 *
 * @example
 * ```ts
 * const DamageMessage = message<{ target: number; amount: number }>();
 *
 * const combatSystem = (world: World) => {
 *   const writer = world.getMessageWriter(DamageMessage);
 *   writer.write({ target: enemyId, amount: 25 });
 * };
 * ```
 */
export class MessageWriter<T> {
  private queue: MessageQueue<T>;

  constructor(queue: MessageQueue<T>) {
    this.queue = queue;
  }

  /**
   * Write an message to be read by listeners.
   * The message will be available for 2 frames.
   */
  public write(message: T): void {
    this.queue.write(message);
  }
}

/**
 * Cursor-based reader - each reader tracks its own position.
 * Calling `read()` returns only messages since last read and advances the cursor.
 * This ensures each reader sees each message exactly once.
 *
 * **Important:** Store and reuse the reader instance across frames.
 * Creating a new reader each frame will miss messages.
 *
 * @example
 * ```ts
 * const DamageMessage = message<{ target: number; amount: number }>();
 *
 * // Store reader outside the system (or in a resource)
 * let damageReader: MessageReader<{ target: number; amount: number }> | null = null;
 *
 * const healthSystem = (world: World) => {
 *   // Get or create reader (reuse across frames)
 *   if (!damageReader) {
 *     damageReader = world.getMessageReader(DamageMessage);
 *   }
 *
 *   for (const message of damageReader.read()) {
 *     const health = world.entity(message.target).getMut(Health);
 *     if (health) health.current -= message.amount;
 *   }
 * };
 * ```
 */
export class MessageReader<T> {
  private queue: MessageQueue<T>;
  private lastReadId: number;

  constructor(queue: MessageQueue<T>) {
    this.queue = queue;
    // Start at oldest available message so we don't miss any
    this.lastReadId = queue.getOldestId();
  }

  /**
   * Read all messages since last read and advance the cursor.
   * Each message is returned exactly once per reader.
   */
  public read(): T[] {
    const messages = this.queue.iter();
    const unread = messages.filter((e) => e.id >= this.lastReadId);

    if (unread.length > 0) {
      // Advance cursor past the last read message
      this.lastReadId = unread[unread.length - 1].id + 1;
    }

    return unread.map((e) => e.data);
  }

  /**
   * Check if there are unread messages without consuming them.
   */
  public hasUnread(): boolean {
    return this.queue.iter().some((e) => e.id >= this.lastReadId);
  }

  /**
   * Count of unread messages.
   */
  public len(): number {
    return this.queue.iter().filter((e) => e.id >= this.lastReadId).length;
  }

  /**
   * Check if there are no unread messages.
   */
  public isEmpty(): boolean {
    return !this.hasUnread();
  }

  /**
   * Clear the read history, allowing all current messages to be read again.
   */
  public reset(): void {
    this.lastReadId = this.queue.getOldestId();
  }
}
