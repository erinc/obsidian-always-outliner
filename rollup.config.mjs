import commonjs from "@rollup/plugin-commonjs";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

export default () => ({
  input: "src/main.ts",
  output: {
    file: "dist/main.js",
    sourcemap: "inline",
    format: "cjs",
    exports: "default",
  },
  external: ["obsidian", "codemirror", "@codemirror/state", "@codemirror/view"],
  plugins: [
    typescript(),
    nodeResolve({ browser: true }),
    commonjs(),
  ],
});
