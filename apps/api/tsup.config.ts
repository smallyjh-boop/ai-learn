import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  clean: true,
  splitting: false,
  // 共享包是 TS 源码，必须打进产物
  noExternal: ["@ai-learn/shared", "@ai-learn/content"],
});
