import { RuleTester } from "eslint";
import rule from "../dist/eslint-plugin/rules/require-thresholds.js";

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: "module" },
});

ruleTester.run("require-thresholds", rule, {
  valid: [
    // has thresholds
    `
    export const options = {
      vus: 50,
      duration: '1m',
      thresholds: { http_req_duration: ['p(95)<500'] }
    };
    `,
    // module.exports with nested options.thresholds
    `
    module.exports = { options: { thresholds: { http_req_failed: ['rate<0.01'] } } };
    `,
    // exports.options assigned
    `
    exports.options = { thresholds: { http_req_duration: ['p(95)<500'] } };
    `,
  ],
  invalid: [
    {
      code: `
      export const options = { vus:50, duration: '1m' };
      `,
      errors: [{ messageId: "missingThresholds" }],
    },
    {
      code: `
      module.exports = { options: { vus:50 } };
      `,
      errors: [{ messageId: "missingThresholds" }],
    },
    {
      code: `
      exports.options = { vus:50 };
      `,
      errors: [{ messageId: "missingThresholds" }],
    },
    {
      code: `
      const options = { vus:10 };
      export { options };
      `,
      errors: [{ messageId: "missingThresholds" }],
    },
    // thresholds present but empty
    {
      code: `
      export const options = { thresholds: {} };
      `,
      errors: [{ messageId: "missingThresholds" }],
    },
    {
      code: `
      export const options = { thresholds: { http_req_duration: [] } };
      `,
      errors: [{ messageId: "missingThresholds" }],
    },
    {
      code: `
      import http from "k6/http";

        export const options = {
        vus: 50,
        duration: "1m",
        // Nenhuma seção de "thresholds" definida.
        };

        export default function () {
        let res = http.get("https://test.k6.io");
        check(res, { "res is 200": res.status === 200 });
        }

      `,
      errors: [{ messageId: "missingThresholds" }],
    },
  ],
});

console.log("require-thresholds tests passed!");
