import { component } from "@ecs/Registry";
import type { Hex } from "@game/puzzle/pixel";
import {
  BufferGeometry,
  Euler,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";

export interface TransformProps {
  position?: Vector3;
  rotation?: Euler;
  scale?: Vector3;
}

export const Transform = component((props?: TransformProps) => ({
  position: props?.position ?? new Vector3(0, 0, 0),
  rotation: props?.rotation ?? new Euler(0, 0, 0),
  scale: props?.scale ?? new Vector3(1, 1, 1),
}));

export interface MaterialDataProps {
  color?: Hex;
  opacity?: number;
}

export const MaterialData = component((props?: MaterialDataProps) => ({
  color: props?.color ?? "#ffffff",
  opacity: props?.opacity ?? 1,
}));

export type InstanceId = `instance-${string}`;

export interface MeshRefProps {
  mesh:
    | Mesh<BufferGeometry, MeshBasicMaterial | MeshStandardMaterial>
    | InstanceId;
}

export const MeshRef = component((props: MeshRefProps) => ({
  mesh: props.mesh,
}));

export interface CameraAnimationProps {
  targetZoom?: number;
  speed?: number;
}

export const CameraAnimation = component((params?: CameraAnimationProps) => ({
  targetZoom: params?.targetZoom ?? 1,
  speed: params?.speed ?? 1,
}));

export const isInstanceId = (mesh: Mesh | InstanceId): boolean => {
  return typeof mesh === "string" && mesh.startsWith("instance-");
};

export const isMesh = (mesh: Mesh | InstanceId): boolean => {
  return mesh instanceof Mesh;
};
