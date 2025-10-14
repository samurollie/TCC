import { RuleTester } from "eslint";
import rule from "../dist/eslint-plugin/rules/require-check.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("require-check", rule, {
  valid: [
    // default function with http and check
    `
    import http from 'k6/http';
    export default function () {
      const res = http.get('https://example.com');
      check(res, { 'status is 200': r => r.status === 200 });
    }
    `,
    // scenario exec function with http and check
    `
    import http from 'k6/http';
    export const options = { scenarios: { s1: { exec: 'worker' } } };
    function worker(){
      const res = http.get('https://example.com');
      check(res, { ok: r => r.status === 200 });
    }
    export default function () {}
    `,
  ],
  invalid: [
    // default function with http but no check
    {
      code: `
      import http from 'k6/http';
      export default function () {
        http.get('https://example.com');
      }
      `,
      errors: [{ messageId: "missingCheckDefault" }],
    },
    // scenario function with http but no check
    {
      code: `
      import http from 'k6/http';
      export const options = { scenarios: { s1: { exec: 'worker' } } };
      function worker(){
        http.get('https://example.com');
      }
      export default function () {}
      `,
      errors: [{ messageId: "missingCheckFunction" }],
    },
  ],
});

console.log("require-check tests passed!");
