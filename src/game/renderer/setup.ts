import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/Addons.js";
import { World } from "../../ecs/World";
import { RendererData } from "./renderer";

export const setupRenderer = (world: World) => {
  const container = document.getElementById("app");
  if (!container) {
    throw new Error("Container element not found");
  }

  const scene = createScene();
  const camera = createCamera();
  const renderer = createRenderer(container);
  const controls = createControls(camera, renderer);

  window.addEventListener("resize", () => resizeListener(camera, renderer));

  const geometry = new BoxGeometry(1, 1, 1);
  const material = new MeshBasicMaterial({ color: 0x00ff00 });
  const cube = new Mesh(geometry, material);
  scene.add(cube);

  world.insertResource(
    RendererData({
      container,
      renderer,
      camera,
      controls,
      scene,
    }),
  );
};

const resizeListener = (camera: PerspectiveCamera, renderer: WebGLRenderer) => {
  camera.aspect = window.innerWidth / window.innerHeight;
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

const createCamera = (): PerspectiveCamera => {
  const camera = new PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
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
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
): OrbitControls => {
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  return controls;
};
