import noHeavyInitContext from "./eslint-plugin/rules/no-heavy-init-context.js";
import requireCheck from "./eslint-plugin/rules/require-check.js";
import featureEnvyTags from "./eslint-plugin/rules/require-tags.js";
import requireThresholds from "./eslint-plugin/rules/require-thresholds.js";

const plugin = {
  meta: {
    name: "eslint-plugin-k6-performance",
    version: "1.0.0",
  },
  rules: {
    "no-heavy-init-context": noHeavyInitContext,
    "require-check": requireCheck,
    "require-tags": featureEnvyTags,
    "require-thresholds": requireThresholds,
  },
  configs: {
    recommended: {
      plugins: ["k6-performance"],
      rules: {
        "k6-performance/no-heavy-init-context": "error",
        "k6-performance/require-check": "error",
        "k6-performance/require-tags": "error",
        "k6-performance/require-thresholds": "error",
      },
    },
  },
};

export default plugin;
