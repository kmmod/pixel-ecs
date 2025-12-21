import {
  AmbientLight,
  Color,
  DirectionalLight,
  OrthographicCamera,
  Raycaster,
  Scene,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { World } from "@ecs/World";
import { RendererData } from "./renderer";

const frustumSize = 2;

export const setupRenderer = (world: World) => {
  const container = document.getElementById("app");
  if (!container) {
    throw new Error("Container element not found");
  }

  const scene = createScene();
  const camera = createCamera();
  const renderer = createRenderer(container);
  const controls = createControls(camera, renderer);
  const raycast = new Raycaster();

  window.addEventListener("resize", () => resizeListener(camera, renderer));

  world.insertResource(
    RendererData({
      container,
      renderer,
      camera,
      controls,
      scene,
      raycast,
      raycastResult: [],
    }),
  );
};

const resizeListener = (
  camera: OrthographicCamera,
  renderer: WebGLRenderer,
) => {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;

  camera.left = (-frustumSize * aspect) / 2;
  camera.right = (frustumSize * aspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = -frustumSize / 2;

  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

const createScene = (): Scene => {
  const scene = new Scene();
  scene.background = new Color(0x20232a);

  const ambientLight = new AmbientLight(0xffffff, 0.1);
  scene.add(ambientLight);

  const directionalLight = new DirectionalLight(0xffffff, 1);
  directionalLight.position.set(1, 5, 2);
  scene.add(directionalLight);

  return scene;
};

const createCamera = (): OrthographicCamera => {
  const aspect = window.innerWidth / window.innerHeight;
  const camera = new OrthographicCamera(
    (-frustumSize * aspect) / 2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    -frustumSize / 2,
    0.1,
    1000,
  );
  camera.position.set(0, 0, -5);
  return camera;
};

const createRenderer = (container: HTMLElement): WebGLRenderer => {
  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);
  return renderer;
};

const createControls = (
  camera: OrthographicCamera,
  renderer: WebGLRenderer,
): OrbitControls => {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableRotate = false;
  controls.zoomToCursor = true;
  return controls;
};
