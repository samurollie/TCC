import k6Performance from "./dist/index.js";

export default [
  {
    files: ["k6-scripts/**/*.js"],
    plugins: {
      "k6-performance": k6Performance,
    },
    rules: {
      "k6-performance/no-heavy-init-context": "error",
      "k6-performance/require-check": "error",
    },
  },
];
