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
    // default function with alias of check
    `
    import http from 'k6/http';
    import { check as assert } from 'k6';
    export default function () {
      const res = http.get('https://example.com');
      assert(res, { ok: r => r.status === 200 });
    }
    `,
    // namespace import k6.check
    `
    import http from 'k6/http';
    import * as k6 from 'k6';
    export default function () {
      const res = http.get('https://example.com');
      k6.check(res, { ok: r => r.status === 200 });
    }
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
    // alias present but not used (should still fail)
    {
      code: `
      import http from 'k6/http';
      import { check as assert } from 'k6';
      export default function () {
        http.get('https://example.com');
      }
      `,
      errors: [{ messageId: "missingCheckDefault" }],
    },
  ],
});

console.log("require-check tests passed!");
