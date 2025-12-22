import { component } from "@ecs/Registry";
import {
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from "three";

export type InstanceId = `instance-${string}`;

export interface MeshRefProps {
  mesh: Mesh<BufferGeometry, MeshBasicMaterial | MeshStandardMaterial>;
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
