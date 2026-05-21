import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "src/renderer-settings"),
  server: {
    host: "127.0.0.1",
    port: 5181,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@settings": path.resolve(__dirname, "src/renderer-settings"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
});
