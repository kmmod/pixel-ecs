import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "./src/app"),
      "@ecs": path.resolve(__dirname, "./src/ecs"),
      "@game": path.resolve(__dirname, "./src/game"),
    },
  },
});
