import type { EventReader } from "@ecs/Event";
import { World } from "@ecs/World";
import {
  CameraAnimation,
  MaterialData,
  MeshRef,
  Transform,
} from "@game/renderer/components";
import {
  Vector3,
  BoxGeometry,
  MeshBasicMaterial,
  Mesh,
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  PlaneGeometry,
  BufferGeometry,
} from "three";
import { type FileEventProps, FileEvent } from "./puzzle";
import {
  Coordinate,
  Pixel,
  pixelScale,
  rgbToHex,
  type CoordinateProps,
  type PixelProps,
} from "./pixel";

let puzzleEventReader: EventReader<FileEventProps> | null = null;
export const generatePuzzle = (world: World) => {
  puzzleEventReader ??= world.getEventReader(FileEvent);

  for (const event of puzzleEventReader.read()) {
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
    const coordinates = generateCoordinates(pixels, img.width, img.height);
    spawnPixels(world, pixels);
    spawnCoordinates(world, coordinates);
  };
};

const spawnPixels = (world: World, pixels: PixelProps[]) => {
  for (const pixel of pixels) {
    // TODO: spawn white, using value for testing
    const color = "#ffffff";
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial({ color });
    const cube = new Mesh(geometry, material);
    const position = new Vector3(pixel.cell.x, pixel.cell.y, 0);
    const scale = new Vector3().setScalar(pixelScale);
    world.spawn(
      Transform({ position, scale }),
      MaterialData({ color }),
      MeshRef({ mesh: cube }),
      Pixel(pixel),
    );
  }
};

const spawnCoordinates = (world: World, coordinates: CoordinateProps[]) => {
  for (const coord of coordinates) {
    const position = new Vector3(coord.cell.x, coord.cell.y, 1.0); // Slight z offset
    const mesh = createNumberMesh(coord.value);
    world.spawn(
      Transform({ position }),
      MaterialData({ color: "#000000" }),
      MeshRef({ mesh }),
      Coordinate(coord),
    );
  }
};

const createNumberMesh = (
  value: number,
): Mesh<BufferGeometry, MeshBasicMaterial> => {
  const canvas = document.createElement("canvas");
  const size = 64;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d")!;

  // Draw circle background
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw number
  ctx.fillStyle = "#000000";
  ctx.font = "bold 40px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(value.toString(), size / 2, size / 2 + 3);

  // Create texture from canvas
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;

  const geometry = new PlaneGeometry(1, 1);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: DoubleSide,
  });

  return new Mesh(geometry, material);
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

const generateCoordinates = (
  pixels: PixelProps[],
  imgWidth: number,
  imgHeight: number,
): CoordinateProps[] => {
  // Create a lookup map for pixel values by cell position
  const pixelMap = new Map<string, number>();
  for (const pixel of pixels) {
    const key = `${pixel.cell.x},${pixel.cell.y}`;
    pixelMap.set(key, pixel.value);
  }

  const coordinates: CoordinateProps[] = [];

  // Coordinates are at even positions (0, 2, 4, ...)
  // Grid spans from 0 to imgWidth * 2 horizontally and 0 to imgHeight * 2 vertically
  for (let x = 0; x <= imgWidth * 2; x += 2) {
    for (let y = 0; y <= imgHeight * 2; y += 2) {
      // Look up the 4 adjacent pixels (at odd positions)
      // A coordinate at (x, y) has pixels at:
      // top-left:     (x - 1, y + 1)
      // top-right:    (x + 1, y + 1)
      // bottom-left:  (x - 1, y - 1)
      // bottom-right: (x + 1, y - 1)
      const adjacentOffsets = [
        { dx: -1, dy: 1 }, // top-left
        { dx: 1, dy: 1 }, // top-right
        { dx: -1, dy: -1 }, // bottom-left
        { dx: 1, dy: -1 }, // bottom-right
      ];

      let value = 0;
      for (const { dx, dy } of adjacentOffsets) {
        const pixelKey = `${x + dx},${y + dy}`;
        value += pixelMap.get(pixelKey) ?? 0;
      }

      const coord: CoordinateProps = {
        cell: { x, y },
        value,
        hidden: false,
      };
      coordinates.push(coord);
    }
  }

  return coordinates;
};
