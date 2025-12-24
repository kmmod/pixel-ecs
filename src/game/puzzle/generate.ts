import type { MessageReader } from "@ecs/Message";
import { World } from "@ecs/World";
import {
  CameraAnimation,
  MeshRef,
  setMeshTag,
} from "@game/renderer/components";
import {
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from "three";
import {
  Coordinate,
  innerScale,
  Pixel,
  pixelScale,
  rgbToHex,
  type CoordinateProps,
  type PixelProps,
} from "./pixel";
import { FileMessage, type FileMessageProps } from "./puzzle";

let puzzleMessageReader: MessageReader<FileMessageProps> | null = null;
export const generatePuzzle = (world: World) => {
  puzzleMessageReader ??= world.getMessageReader(FileMessage);

  for (const event of puzzleMessageReader.read()) {
    processFile(world, event.file);

    // TODO: calculate size based on scene bounds using message
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

export const PixelMesh = {
  PlaneOuter: "plane-outer",
  PlaneInner: "plane-inner",
} as const;

export const CoordinateMesh = {
  CircleOuter: "circle-outer",
  CircleInner: "circle-inner",
  Number: "number",
} as const;

export const pixelOuterColor = "#888888";

const spawnPixels = (world: World, pixels: PixelProps[]) => {
  for (const pixel of pixels) {
    const color = "#ffffff";
    const geometry = new PlaneGeometry(1, 1);
    const materialOuter = new MeshBasicMaterial({ color: pixelOuterColor });
    const materialInner = new MeshBasicMaterial({ color });
    const planeOuter = new Mesh(geometry, materialOuter);
    const planeInner = new Mesh(geometry, materialInner);
    planeOuter.add(planeInner);

    planeOuter.position.set(pixel.cell.x, pixel.cell.y, -0.1);
    planeOuter.scale.setScalar(pixelScale);

    planeInner.position.z += 0.1;
    planeInner.scale.setScalar(innerScale);
    planeInner.raycast = () => {};

    setMeshTag(planeOuter, PixelMesh.PlaneOuter);
    setMeshTag(planeInner, PixelMesh.PlaneInner);

    world.spawn(MeshRef({ mesh: planeOuter }), Pixel(pixel));
  }
};

const spawnCoordinates = (world: World, coordinates: CoordinateProps[]) => {
  for (const coord of coordinates) {
    const position = new Vector3(coord.cell.x, coord.cell.y, 0.2); // Slight z offset
    const circleOuter = createCircleMesh(0.75, "#000000");
    const circleInner = createCircleMesh(0.7, "#ffffff");
    const number = createNumberSprite(coord.value);

    setMeshTag(circleOuter, CoordinateMesh.CircleOuter);
    setMeshTag(circleInner, CoordinateMesh.CircleInner);
    setMeshTag(number, CoordinateMesh.Number);

    circleOuter.add(circleInner);
    circleOuter.add(number);

    circleOuter.position.copy(position);
    circleInner.position.z += 0.1;
    number.position.z += 0.2;

    world.spawn(MeshRef({ mesh: circleOuter }), Coordinate(coord));
  }
};

const createCircleMesh = (
  diameter: number,
  color: string = "#ffffff",
): Mesh<BufferGeometry, MeshBasicMaterial> => {
  const geometry = new CircleGeometry(diameter / 2, 32);
  const material = new MeshBasicMaterial({
    color,
  });

  return new Mesh(geometry, material);
};

const createNumberSprite = (
  value: number,
): Mesh<BufferGeometry, MeshBasicMaterial> => {
  const canvas = document.createElement("canvas");
  const size = 128;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d")!;

  // Draw number
  ctx.font = `${size / 2}px Sans-Serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.strokeStyle = "#444444";
  ctx.lineWidth = size / 32;
  ctx.strokeText(value.toString(), size / 2, size / 2);

  ctx.fillStyle = "#000000";
  ctx.fillText(value.toString(), size / 2, size / 2);

  // Create texture from canvas
  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;

  const scale = 0.75;
  const geometry = new PlaneGeometry(scale, scale);
  const material = new MeshBasicMaterial({
    color: "#ffffff",
    map: texture,
    transparent: true,
  });

  const mesh = new Mesh(geometry, material);
  mesh.raycast = () => {};

  return mesh;
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

      // Skip fully transparent pixels
      // if (a === 0) continue;
      //

      const xPos = x * 2 + 1;
      const yPos = y * 2 + 1;
      const cell = { x: xPos, y: yPos };
      if (a === 0) {
        const pixel: PixelProps = {
          cell,
          color: "#ffffff",
          value: 0,
          marked: false,
        };
        pixels.push(pixel);
      } else {
        const color = rgbToHex(r, g, b);
        const value = r < 250 || g < 250 || b < 250 ? 1 : 0;

        const pixel: PixelProps = {
          cell: { x: xPos, y: yPos },
          color,
          value,
          marked: false,
        };

        pixels.push(pixel);
      }
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
