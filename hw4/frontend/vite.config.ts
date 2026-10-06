import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API normally runs on 8000. Override with API_PORT when that port is taken.
const apiTarget = `http://127.0.0.1:${process.env.API_PORT || 8000}`;

// Proxying keeps the frontend same-origin in dev, so image URLs and API calls
// can both be plain relative paths.
export default defineConfig({
  plugins: [react()],
  server: {
    // Honor a PORT assigned by the environment; fall back to Vite's default.
    port: Number(process.env.PORT) || 5173,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/static": { target: apiTarget, changeOrigin: true },
    },
  },
});
