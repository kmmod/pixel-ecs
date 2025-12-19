import { resource } from "../ecs/Registry";
import { World } from "../ecs/World";

export const Time = resource(() => ({ delta: 0, elapsed: 0 }));

export class App {
  private world: World;
  private running = false;
  private initialised = false;
  private animationFrameId: number | null = null;

  constructor(world: World) {
    this.world = world;
  }

  public async runAsync(): Promise<void> {
    await this.world.initAsync();
    this.initialised = true;
    this.run();
  }

  public run(): void {
    if (!this.initialised) {
      this.world.init();
      this.initialised = true;
    }

    this.running = true;

    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      if (!this.running) return;

      const delta = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      // Update Time resource
      const time = this.world.getResource(Time);
      if (time) {
        time.delta = delta;
        time.elapsed += delta;
      }

      this.world.update();
      this.animationFrameId = requestAnimationFrame(loop);

      // TODO: Debug tools ideas:
      // - Log frame time, entity count, system execution times
      // - Log entities without components
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stop(): void {
    this.running = false;
  }

  public resume(): void {
    if (!this.running) {
      this.running = true;
      this.run();
    }
  }
}
