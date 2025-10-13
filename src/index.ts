import noHeavyInitContext from "./eslint-plugin/rules/no-heavy-init-context.js";


const plugin = {
  meta: {
    name: "eslint-plugin-k6-performance",
    version: "1.0.0",
  },
  rules: {
    "no-heavy-init-context": noHeavyInitContext,
  },
  configs: {
    recommended: {
      plugins: ["k6-performance"],
      rules: {
        "k6-performance/no-heavy-init-context": "error",
      },
    },
  },
};

export default plugin;
