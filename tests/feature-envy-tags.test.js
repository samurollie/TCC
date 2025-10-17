import { RuleTester } from "eslint";
import rule from "../dist/eslint-plugin/rules/feature-envy-tags.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("feature-envy-tags", rule, {
  valid: [
    `
      import http from 'k6/http';
      http.get('https://api.com/products', { tags: { name: 'ProductsAPI' } });
      http.get('https://api.com/cart', { tags: { name: 'CartAPI' } });
    `,
    `
      import http from 'k6/http';
      http.post('https://api.com/login', { tags: { name: 'LoginAPI' } });
    `,
  ],
  invalid: [
    {
      code: `
        import http from 'k6/http';
        http.get('https://api.com/products');
        http.get('https://api.com/cart');
      `,
      errors: [{ messageId: "missingTags" }, { messageId: "missingTags" }],
    },
    {
      code: `
        import http from 'k6/http';
        http.get('https://api.com/products', { tags: { name: 'API' } });
        http.get('https://api.com/cart', { tags: { name: 'API' } });
      `,
      errors: [{ messageId: "duplicateTag" }, { messageId: "duplicateTag" }],
    },
  ],
});

console.log("feature-envy-tags tests passed!");
