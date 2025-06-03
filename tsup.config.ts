import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ["src/index.ts", "!examples/**"],
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  outDir: "dist",
  noExternal: [], // Bundle all dependencies
  platform: "neutral", // Target both Node.js and browsers
});
