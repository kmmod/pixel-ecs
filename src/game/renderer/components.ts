import { component } from "@ecs/Registry";
import { Vector3, type Mesh } from "three";

export interface TransformProps {
  position?: Vector3;
  rotation?: Vector3;
  scale?: Vector3;
}

export const Transform = component((props?: TransformProps) => ({
  position: props?.position ?? new Vector3(0, 0, 0),
  rotation: props?.rotation ?? new Vector3(0, 0, 0),
  scale: props?.scale ?? new Vector3(1, 1, 1),
}));

export const MeshComponent = component((mesh: Mesh) => mesh);

export interface CameraAnimationProps {
  targetZoom?: number;
  speed?: number;
}

export const CameraAnimation = component((params?: CameraAnimationProps) => ({
  targetZoom: params?.targetZoom ?? 1,
  speed: params?.speed ?? 1,
}));
