/// <reference types="vitest" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
// ANALYZE=1 bun run build → also emits dist/stats.html with treemap.
const enableVisualizer = process.env.ANALYZE === "1";

const manualChunkGroups: Record<string, string[]> = {
  // Core React ecosystem
  "vendor-react": [
    "react",
    "react-dom",
    "react-router",
    "react-router-dom",
    "scheduler",
    "@remix-run/router",
    "use-sync-external-store",
  ],
  // Radix UI is intentionally NOT pinned to one vendor chunk. The app shell
  // only needs a small subset, while many heavier Radix components live in lazy
  // panels. Letting Rollup split it naturally avoids preloading all of Radix.
  // Charts (recharts) is intentionally NOT pinned to a vendor chunk:
  // it's only used by lazy panels, so leaving it to Rollup lets it split
  // into an on-demand async chunk instead of being modulepreloaded on
  // first paint (~400 KB / ~110 KB gz saved on initial load).
  // Animation (framer-motion) is intentionally NOT pinned to a vendor chunk:
  // it is mostly used by lazy pages/panels, and manual chunk dependency
  // merging can otherwise pull it into the app shell.
  // Date utilities
  "vendor-date": ["date-fns"],
  // Drag and drop is intentionally NOT pinned for the same reason; inactive
  // task/board panels should not force dnd-kit into the first load.
  // Data fetching
  "vendor-query": ["@tanstack/react-query"],
  // Supabase
  "vendor-supabase": ["@supabase/supabase-js"],
  // Form handling
  "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
};

const manualChunkEntries = Object.entries(manualChunkGroups).flatMap(([chunk, packages]) =>
  packages.map((pkg) => [pkg, chunk] as const),
);

function manualChunks(id: string): string | undefined {
  const normalized = id.replace(/\\/g, "/");
  const marker = "/node_modules/";
  const idx = normalized.lastIndexOf(marker);
  if (idx === -1) return undefined;

  const modulePath = normalized.slice(idx + marker.length);
  for (const [pkg, chunk] of manualChunkEntries) {
    if (modulePath === pkg || modulePath.startsWith(`${pkg}/`)) return chunk;
  }

  return undefined;
}

const requiredClientEnv = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

function isPlaceholderClientEnv(name: string, value: string): boolean {
  return (
    (name === "VITE_SUPABASE_URL" && value === "https://placeholder.supabase.co") ||
    (name === "VITE_SUPABASE_PUBLISHABLE_KEY" && value === "placeholder-anon-key")
  );
}

function validateClientEnvForBuild({
  command,
  mode,
  env,
}: {
  command: string;
  mode: string;
  env: Record<string, string | undefined>;
}) {
  if (command !== "build" || mode === "development") return;

  const missing = requiredClientEnv.filter((key) => {
    const value = env[key]?.trim();
    return !value || value === "undefined" || value === "null";
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required client environment variable(s): ${missing.join(
        ", ",
      )}. Copy .env.example to .env or configure them in the deploy environment.`,
    );
  }

  const allowPlaceholders = env.CI === "true" || env.VITE_ALLOW_PLACEHOLDER_CLIENT_ENV === "true";
  const placeholderKeys = requiredClientEnv.filter((key) =>
    isPlaceholderClientEnv(key, env[key]?.trim() ?? ""),
  );

  if (placeholderKeys.length > 0 && !allowPlaceholders) {
    throw new Error(
      `Placeholder client environment value(s) are only allowed in CI or when VITE_ALLOW_PLACEHOLDER_CLIENT_ENV=true: ${placeholderKeys.join(
        ", ",
      )}.`,
    );
  }

  const supabaseUrl = env.VITE_SUPABASE_URL?.trim() ?? "";
  try {
    const parsedUrl = new URL(supabaseUrl);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error("Supabase URL must be http or https.");
    }
  } catch {
    throw new Error(`VITE_SUPABASE_URL must be a valid http(s) URL. Received: ${supabaseUrl}`);
  }
}

export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ""), ...process.env };
  validateClientEnvForBuild({ command, mode, env });

  return {
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      css: false,
      // Placeholder Supabase config so modules that eagerly construct the
      // client at import time (e.g. lib/telemetry.ts) don't throw
      // "supabaseUrl is required" under vitest. Mirrors the CI build env.
      env: {
        VITE_SUPABASE_URL: "https://placeholder.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "placeholder-anon-key",
      },
    },
    server: {
      host: "::",
      port: 8080,
    },
    build: {
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: ["log", "info", "debug"],
          pure_funcs: ["console.log", "console.info", "console.debug"],
        },
      },
      rollupOptions: {
        // Strip dev-only logging from production bundles. Vite 8 uses Oxc by
        // default, so top-level esbuild pure/drop settings are ignored. Terser
        // catches calls that survive Rollup tree-shaking.
        treeshake: {
          manualPureFunctions: ["console.log", "console.info", "console.debug"],
        },
        output: {
          manualChunks,
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "robots.txt"],
        manifest: false, // We use public/manifest.json
        workbox: {
          // Take over open tabs as soon as a new SW activates instead of
          // waiting until every tab is closed. Without these, deploys
          // could leave users pinned to an old precached bundle for
          // days — which is how the realtime-channel bug after #6/#7
          // stayed visible to refreshed clients.
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB limit
          globPatterns: ["**/*.{css,html,ico,png,svg,woff,woff2}"],
          globIgnores: [
            "**/stats.html",
            "stats.html",
            "**/*.map",
            "android-icons/**",
            "ios-icons/**",
            "icons/icon-1024.png",
          ],
          runtimeCaching: [
            {
              urlPattern: ({ request, sameOrigin }) =>
                sameOrigin && request.destination === "script",
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "darai-js-assets",
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 7 * 24 * 60 * 60,
                },
              },
            },
          ],
          // No runtime caching of third-party origins. The Arabic/Quran fonts are
          // self-hosted under public/fonts/ and picked up by the precache globs
          // above (css + woff2), so there is no Google Fonts CDN to cache.
        },
      }),
      enableVisualizer &&
        visualizer({
          filename: "dist/stats.html",
          gzipSize: true,
          brotliSize: true,
          template: "treemap",
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
