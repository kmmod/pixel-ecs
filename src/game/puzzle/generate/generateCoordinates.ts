import { World } from "@ecs/World.ts";
import {
  Coordinate,
  type CoordinateProps,
  type PixelProps,
} from "@game/puzzle/pixel.ts";
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
import { MeshRef, setMeshTag } from "@game/renderer/components.ts";

export const CoordinateMesh = {
  CircleOuter: "circle-outer",
  CircleInner: "circle-inner",
  Number: "number",
} as const;

export const spawnCoordinates = (
  world: World,
  coordinates: CoordinateProps[],
) => {
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

export const generateCoordinates = (
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
