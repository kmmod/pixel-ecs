// Grid layout
//
// Pixels are located at odd coordinates (1, 3, 5, ...)
// Coordinates are located at even coordinates (0, 2, 4, ...)
//
// C - coordinate
// P - pixel
//
// C . C . C . C
// . P . P . P .
// C . C . C . C
// . P . P . P .
// C . C . C . C
//

import { component } from "@ecs/Registry";

export type Cell = {
  x: number; // Integer x
  y: number; // Integer y
};

export interface PixelProps {
  cell: Cell; // Position of the pixel in the grid, int coordinates
  color: Hex; // Target color in hex format, e.g., "#ff0000"
  value: number; // 0 or 1, representing the desired state of the pixel
  marked: boolean; // Whether the player has marked the pixel
}

export const Pixel = component((props: PixelProps) => props);

export interface CoordinateProps {
  cell: Cell; // Position of the coordinate in the grid, int coordinates
  value: number; // Number representing the clue for this coordinate
  hidden: boolean; // Whether the clue is hidden
}

export const Coordinate = component((props: CoordinateProps) => props);

export type Hex = `#${string}`;

export const isPixel = (x: number, y: number) => x % 2 === 1 && y % 2 === 1;

export const isCoordinate = (x: number, y: number) =>
  x % 2 === 0 && y % 2 === 0;

export const rgbToHex = (r: number, g: number, b: number): Hex => {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

export const pixelScale = 2.0;
export const innerScale = 0.98;
export const hoverScale = 0.9;
export const hoverSpeed = 8.0;

export const diagonalOffsets = [
  { x: -1, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
];

export const pixelSolved = (pixel: PixelProps): boolean =>
  (pixel.value === 1 && pixel.marked) || (pixel.value === 0 && !pixel.marked);
