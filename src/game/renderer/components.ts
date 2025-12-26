import { component } from "@ecs/Registry";
import {
  BufferGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Vector2,
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
  targetPosition?: Vector2;
  speed?: number;
}

export const CameraAnimation = component((params?: CameraAnimationProps) => ({
  targetZoom: params?.targetZoom ?? 1,
  targetPosition: params?.targetPosition ?? new Vector2(0, 0),
  speed: params?.speed ?? 1,
}));

export const getChildByTag = (
  parent: Object3D,
  type: string,
): Object3D | undefined => {
  let found: Object3D | undefined = undefined;
  parent.traverse((child) => {
    if (child.userData.type === type) {
      found = child;
    }
  });
  return found;
};

export const setMeshTag = (obj: Object3D, type: string) => {
  obj.userData.type = type;
};
