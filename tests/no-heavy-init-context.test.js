import { RuleTester } from "eslint";
import rule from "../dist/eslint-plugin/rules/no-heavy-init-context.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-heavy-init-context", rule, {
  valid: [
    // Valid: operations inside SharedArray
    `
    import { SharedArray } from "k6/data";
    const data = new SharedArray("test", function() {
      const file = open("data.json");
      return JSON.parse(file);
    });
    `,
    // Valid: operations inside functions
    `
    export default function() {
      const data = open("data.json");
      JSON.parse(data);
    }
    `,
    // Valid: simple variable declarations
    `
    const baseUrl = "https://api.example.com";
    export default function() {
      // test code
    }
    `,
  ],

  invalid: [
    // Invalid: file operation in init context
    {
      code: `const data = open("data.json");`,
      errors: [
        {
          messageId: "fileOperation",
        },
      ],
    },
    // Invalid: JSON parsing in init context
    {
      code: `const parsed = JSON.parse(data);`,
      errors: [
        {
          messageId: "jsonParsing",
        },
      ],
    },
    // Invalid: loop in init context
    {
      code: `
      for (let i = 0; i < 100; i++) {
        console.log(i);
      }
      `,
      errors: [
        {
          messageId: "loopOperation",
        },
      ],
    },
  ],
});

console.log("no-heavy-init-context passed!");
