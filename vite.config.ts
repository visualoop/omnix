import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  // Resolve the variant for this build. Priority:
  //   1. process.env.VITE_OMNIX_VARIANT (CI matrix sets this per build)
  //   2. .env / .env.production / .env.local (Vite's loadEnv)
  //   3. fallback to 'pro' so dev mode + legacy v0.3.x reproduce today's behaviour
  const env = loadEnv(mode, process.cwd(), "");
  // @ts-expect-error process is a nodejs global
  const variant = (process.env.VITE_OMNIX_VARIANT ?? env.VITE_OMNIX_VARIANT ?? "pro").toLowerCase();
  const validVariants = ["pro", "dawa", "retail", "hospitality", "hardware"];
  const resolvedVariant = validVariants.includes(variant) ? variant : "pro";

  // Log so CI logs make it obvious which variant is being built.
  // eslint-disable-next-line no-console
  console.log(`\n[vite] Building variant: ${resolvedVariant} (mode=${mode})\n`);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Hard-bake the variant. Vite's automatic env resolution can drop
    // the env var if Tauri's child-process spawn doesn't propagate the
    // parent's env (it usually does on Linux/macOS, sometimes drops on
    // Windows). Using `define` to literally string-replace the access
    // path bypasses that entirely — the bundle ends up with the literal
    // "dawa" / "retail" / etc. burned in at parse time.
    define: {
      "import.meta.env.VITE_OMNIX_VARIANT": JSON.stringify(resolvedVariant),
      __OMNIX_VARIANT__: JSON.stringify(resolvedVariant),
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.7.17"),
    },
    envPrefix: ["VITE_"],

    clearScreen: false,
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
        ignored: ["**/src-tauri/**"],
      },
    },
  };
});
