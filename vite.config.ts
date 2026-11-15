import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

function copyStaticAssetsPlugin() {
  return {
    name: "copy-static-presentation-assets",
    closeBundle() {
      const distDir = path.resolve(__dirname, "dist");
      if (!fs.existsSync(distDir)) return;

      for (const file of ["style.css", "app.js"]) {
        const src = path.resolve(__dirname, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, path.join(distDir, file));
        }
      }

      const assetsSrc = path.resolve(__dirname, "assets");
      const assetsDest = path.join(distDir, "assets");
      if (fs.existsSync(assetsSrc)) {
        fs.cpSync(assetsSrc, assetsDest, { recursive: true });
      }
    },
  };
}

export default defineConfig(() => {
  return {
    publicDir: false as const,
    plugins: [copyStaticAssetsPlugin()],
    server: {
      hmr: process.env.DISABLE_HMR !== "true",
      watch: process.env.DISABLE_HMR === "true" ? null : {},
    },
  };
});
