import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { wasm } from "@rollup/plugin-wasm";
import copy from "rollup-plugin-copy";

export default {
  input: {
    index: "dist/index.js",
  },
  output: {
    dir: "bundle",
    format: "esm",
  },
  plugins: [
    copy({
      hook: "buildStart",
      targets: [{ src: "src/zerokit/rln_wasm_bg.wasm", dest: "dist/zerokit" }],
    }),
    commonjs(),
    json(),
    wasm({
      maxFileSize: 0,
    }),
    nodeResolve({
      browser: true,
      preferBuiltins: false,
      extensions: [".js", ".ts", ".wasm"],
    }),
  ],
};
