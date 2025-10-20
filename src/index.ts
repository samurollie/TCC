import noHeavyInitContext from "./eslint-plugin/rules/no-heavy-init-context.js";
import requireCheck from "./eslint-plugin/rules/require-check.js";
import featureEnvyTags from "./eslint-plugin/rules/feature-envy-tags.js";

const plugin = {
  meta: {
    name: "eslint-plugin-k6-performance",
    version: "1.0.0",
  },
  rules: {
    "no-heavy-init-context": noHeavyInitContext,
    "require-check": requireCheck,
    "feature-envy-tags": featureEnvyTags,
  },
  configs: {
    recommended: {
      plugins: ["k6-performance"],
      rules: {
        "k6-performance/no-heavy-init-context": "error",
        "k6-performance/require-check": "error",
        "k6-performance/feature-envy-tags": "error",
      },
    },
  },
};

export default plugin;
