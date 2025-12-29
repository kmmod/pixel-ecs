import type { World } from "@ecs/World.ts";
import { Startup } from "@ecs/Systems.ts";
import { RegenerateMessage } from "@game/puzzle/generate/generate.ts";

const setupGUI = (world: World) => {
  const sidePanel = document.createElement("div");
  sidePanel.style.position = "absolute";
  sidePanel.style.top = "0";
  sidePanel.style.left = "0";
  sidePanel.style.width = "200px";
  sidePanel.style.height = "100%";
  sidePanel.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  sidePanel.style.color = "white";
  sidePanel.style.padding = "10px";
  sidePanel.style.backdropFilter = "blur(10px)";
  sidePanel.style.transition = "transform 0.3s ease-in-out";
  sidePanel.innerHTML = "<h2>Game GUI</h2o>";
  document.body.appendChild(sidePanel);

  const button = document.createElement("button");
  button.innerText = "Regenerate puzzle";
  button.style.marginTop = "20px";
  button.onclick = () => {
    world.getMessageWriter(RegenerateMessage).write({});
  };
  sidePanel.appendChild(button);

  const foldButton = document.createElement("button");
  const foldLeft = "❮";
  const foldRight = "❯";
  foldButton.innerText = foldLeft;
  foldButton.style.position = "absolute";
  foldButton.style.top = "10px";
  foldButton.style.right = "-30px";
  foldButton.onclick = () => {
    if (sidePanel.style.transform === "translateX(-200px)") {
      sidePanel.style.transform = "translateX(0)";
      foldButton.innerText = foldLeft;
    } else {
      sidePanel.style.transform = "translateX(-200px)";
      foldButton.innerText = foldRight;
    }
  };

  sidePanel.appendChild(foldButton);
};

export const guiBundle = (world: World) => {
  world.addSystem(Startup, setupGUI);
};
