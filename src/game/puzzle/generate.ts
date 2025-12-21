import type { EventReader } from "@ecs/Event";
import { World } from "@ecs/World";
import {
  MeshComponent,
  Transform,
  CameraAnimation,
} from "@game/renderer/components";
import { Vector3, BoxGeometry, MeshBasicMaterial, Mesh } from "three";
import { type FileEventProps, FileEvent } from "./puzzle";
import { Pixel, pixelScale, rgbToHex, type PixelProps } from "./pixel";

let puzzleEventReader: EventReader<FileEventProps> | null = null;
export const generatePuzzle = (world: World) => {
  puzzleEventReader ??= world.getEventReader(FileEvent);

  for (const event of puzzleEventReader.read()) {
    console.log("Generating puzzle from file:", event.file);
    processFile(world, event.file);

    // TODO: calculate size based on scene bounds using event
    const size = 16;
    updateZoom(world, size);
  }
};

const updateZoom = (world: World, size: number) => {
  world.spawn(CameraAnimation({ targetZoom: 1.0 / size, speed: 0.25 }));
};

const processFile = (world: World, file: string) => {
  const img = new Image();
  img.src = file;
  img.onload = () => {
    const pixels = generatePixels(img);
    spawnPixels(world, pixels);
  };
};

const spawnPixels = (world: World, pixels: PixelProps[]) => {
  for (const pixel of pixels) {
    // TODO: spawn white, using value for testing
    const color = pixel.value === 1 ? 0x000000 : 0xffffff;
    const position = new Vector3(pixel.cell.x, pixel.cell.y, 0);
    const scale = new Vector3().setScalar(pixelScale);
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial({ color });
    const cube = new Mesh(geometry, material);
    world.spawn(
      Pixel(pixel),
      MeshComponent(cube),
      Transform({ position, scale }),
    );
  }
};

const generatePixels = (img: HTMLImageElement): PixelProps[] => {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, img.width, img.height);

  const pixels: PixelProps[] = [];

  for (let x = 0; x < img.width; x++) {
    for (let y = 0; y < img.height; y++) {
      const i = (y * img.width + x) * 4;
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const a = imageData.data[i + 3];

      if (a === 0) continue;

      const color = rgbToHex(r, g, b);
      const value = r < 250 || g < 250 || b < 250 ? 1 : 0;
      const xPos = x * 2 + 1;
      const yPos = y * 2 + 1;

      const pixel: PixelProps = {
        cell: { x: xPos, y: yPos },
        color,
        value,
        marked: false,
      };

      pixels.push(pixel);
    }
  }

  return pixels;
};
