// Event queue - holds events for 2 frames then auto-expires
export class EventQueue<T> {
  private events: { data: T; frame: number }[] = [];
  private currentFrame = 0;

  public send(event: T): void {
    this.events.push({ data: event, frame: this.currentFrame });
  }

  public iter(): T[] {
    return this.events.map((e) => e.data);
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
}

// Stateless writer - just sends events
export class EventWriter<T> {
  private queue: EventQueue<T>;

  constructor(queue: EventQueue<T>) {
    this.queue = queue;
  }

  public send(event: T): void {
    this.queue.send(event);
  }
}

// Stateless reader - iterates all non-expired events
export class EventReader<T> {
  private queue: EventQueue<T>;

  constructor(queue: EventQueue<T>) {
    this.queue = queue;
  }

  public read(): T[] {
    return this.queue.iter();
  }

  public isEmpty(): boolean {
    return this.queue.isEmpty();
  }

  public len(): number {
    return this.queue.len();
  }
}
