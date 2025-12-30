import { World } from "@ecs/World.ts";
import {
  innerScale,
  Pixel,
  type PixelProps,
  pixelScale,
  rgbToHex,
} from "@game/puzzle/pixel.ts";
import { Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import { MeshRef, setMeshTag } from "@game/renderer/components.ts";
import { Selectable } from "@game/puzzle/select.ts";

export const PixelMesh = {
  PlaneOuter: "plane-outer",
  PlaneInner: "plane-inner",
} as const;

export const pixelOuterColor = "#888888";

export const spawnPixels = (world: World, pixels: PixelProps[]) => {
  for (const pixel of pixels) {
    // const color = !pixel.value ? "#ffffff" : "#000000";
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

    world.spawn(MeshRef({ mesh: planeOuter }), Pixel(pixel), Selectable());
  }
};

export const generatePixels = (
  img: HTMLImageElement,
  skipTransparent: boolean,
): PixelProps[] => {
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;

  const ctx = canvas.getContext("2d")!;

  ctx.scale(1, -1);
  ctx.translate(0, -img.height);
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
      if (skipTransparent && a === 0) continue;

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
        const value = r < 75 || g < 75 || b < 75 ? 1 : 0;

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
