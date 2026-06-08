import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  // Load OMNIX_VARIANT from process.env so CI can drive the variant build
  // via shell env without forcing every dev to keep a .env file.
  const env = loadEnv(mode, process.cwd(), "");
  // @ts-expect-error process is a nodejs global
  const variant = (process.env.VITE_OMNIX_VARIANT ?? env.VITE_OMNIX_VARIANT ?? "pro").toLowerCase();
  const validVariants = ["pro", "dawa", "retail", "hospitality", "hardware"];
  const resolvedVariant = validVariants.includes(variant) ? variant : "pro";

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      // Inline the variant for non-import.meta consumers (sw, workers, etc.).
      __OMNIX_VARIANT__: JSON.stringify(resolvedVariant),
    },
    envPrefix: ["VITE_"],

    // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
    //
    // 1. prevent Vite from obscuring rust errors
    clearScreen: false,
    // 2. tauri expects a fixed port, fail if that port is not available
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        // 3. tell Vite to ignore watching `src-tauri`
        ignored: ["**/src-tauri/**"],
      },
    },
  };
});
