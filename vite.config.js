import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  base: mode === "pages" ? "/edit-img/" : "/",
  worker: { format: "es" },
  resolve: { alias: [{ find: /^zod$/, replacement: "zod/v3" }] },
}));
