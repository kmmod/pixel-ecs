import styles from "./sidePanel.module.css";
import type { World } from "@ecs/World.ts";
import { RegenerateMessage } from "@game/puzzle/generate/generate.ts";
import { FileMessage } from "@game/puzzle/puzzle.ts";
import { Config } from "@game/globals/config.ts";
import { SolveMessage } from "@game/puzzle/solve.ts";

let open = true;
export const createSidePanel = (world: World): HTMLDivElement => {
  const panel = document.createElement("div");
  panel.className = styles.sidePanel;

  createFoldButton(panel);

  createDropZone(panel, world);

  createButton(panel, "Regenerate Puzzle", () => {
    world.getMessageWriter(RegenerateMessage).write({});
  });

  createButton(panel, "Solve Puzzle", () => {
    world.getMessageWriter(SolveMessage).write({});
  });

  createCheckbox(
    panel,
    "Skip transparent",
    world.getResource(Config).skipTransparent,
    (checked) => {
      world.getResource(Config).skipTransparent = checked;
    },
  );

  document.body.appendChild(panel);
  return panel;
};

const createFoldButton = (panel: HTMLDivElement): void => {
  const button = document.createElement("button");
  const foldLeft = "❮";
  const foldRight = "❯";
  button.className = styles.foldButton;
  button.innerText = foldLeft;
  button.onclick = () => {
    if (open) {
      panel.style.transform = "translateX(-200px)";
      button.innerText = foldRight;
      open = false;
    } else {
      panel.style.transform = "translateX(0)";
      button.innerText = foldLeft;
      open = true;
    }
  };
  panel.appendChild(button);
};

const createButton = (
  panel: HTMLDivElement,
  text: string,
  onClick: () => void,
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.innerText = text;
  button.className = styles.actionButton;
  button.onclick = onClick;
  panel.appendChild(button);
  return button;
};

const createDropZone = (panel: HTMLDivElement, world: World) => {
  const zone = document.createElement("div");
  zone.className = styles.dropZone;
  zone.innerText = "Drop image here or click to choose";

  // Hidden input to support click-to-open
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  fileInput.onchange = () => {
    if (fileInput.files && fileInput.files.length > 0) {
      handleFile(world, fileInput.files[0]);
      fileInput.value = ""; // reset
    }
  };
  panel.appendChild(fileInput);

  // Drag & drop handlers
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "copy";
    zone.classList.add(styles.dropZoneActive);
  };

  const onDragLeave = (_e: DragEvent) => {
    zone.classList.remove(styles.dropZoneActive);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    zone.classList.remove(styles.dropZoneActive);
    const dt = e.dataTransfer;
    if (!dt) return;
    const files = dt.files;
    if (files && files.length > 0) {
      const file = files[0];
      handleFile(world, file);
    }
  };

  zone.addEventListener("dragover", onDragOver);
  zone.addEventListener("dragleave", onDragLeave);
  zone.addEventListener("drop", onDrop);

  // Click opens file picker
  zone.onclick = () => fileInput.click();

  panel.appendChild(zone);
};

const handleFile = (world: World, file: File) => {
  if (!file.type.startsWith("image/")) {
    console.warn("Dropped file is not an image:", file);
    return;
  }

  // Create an object URL for the image file and send FileMessage
  const url = URL.createObjectURL(file);
  try {
    world.getMessageWriter(FileMessage).write({ file: url });
  } catch (err) {
    console.error("Failed to write FileMessage:", err);
    URL.revokeObjectURL(url);
  }
};

const createCheckbox = (
  panel: HTMLDivElement,
  labelText: string,
  initState: boolean,
  onChecked: (checked: boolean) => void,
) => {
  const row = document.createElement("label");
  row.className = styles.checkboxRow;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.className = styles.checkboxInput;

  const label = document.createElement("span");
  label.className = styles.checkboxLabel;
  label.innerText = labelText;

  input.checked = initState;
  input.onchange = () => {
    onChecked(input.checked);
  };

  row.appendChild(input);
  row.appendChild(label);
  panel.appendChild(row);
};
