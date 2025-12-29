import styles from "./sidePanel.module.css";
import type { World } from "@ecs/World.ts";
import { RegenerateMessage } from "@game/puzzle/generate/generate.ts";

let open = true;
export const createSidePanel = (world: World): HTMLDivElement => {
  const panel = document.createElement("div");
  panel.className = styles.sidePanel;

  createFoldButton(panel);
  createButton(panel, "Regenerate Puzzle", () => {
    world.getMessageWriter(RegenerateMessage).write({});
  });

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
