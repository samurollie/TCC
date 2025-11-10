import { RuleTester } from "eslint";
import rule from "../dist/eslint-plugin/rules/require-tags.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("require-tags", rule, {
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
    `
      import http from 'k6/http';
      http.post('https://api.com/login');
    `,
    `
    import http from "k6/http";
    import { sleep, check } from "k6";

    const myTrend = new Trend('my_trend');

    export default function () {
      let r5 = http.get("https://quickpizza.grafana.com", {
        tags: { my_tag: "HealthCheck" },  
      });
      check(r5, { "root ok 5": (r) => r.status === 200 }, {my_tag: "HealthCheck"});
      myTrend.add(r5.timings.connecting, { my_tag: "HealthCheck" });
    }
    `,
    `
    import http from "k6/http";
    import { sleep, check } from "k6";

    export let options = {
      // Scenario: Quick jump from low to very high load, then back down.
      stages: [
        { duration: "1m", target: 50 }, // Baseline load
        { duration: "30s", target: 1000 }, // Immediate, massive spike
        { duration: "1m", target: 50 }, // Quick drop back to baseline
        { duration: "30s", target: 0 }, // Final ramp down
      ],
    };

    export default function () {
      let res = http.get("https://quickpizza.grafana.com");
      check(res, { "status is 200": (r) => r.status === 200 });
      sleep(1);
    }
    `,
    `
    import http from "k6/http";
    import { check } from "k6";

    export const options = {
      thresholds: {
        // Thresholds granulares, por tag:
        "http_req_duration{name:Login}": ["p(95)<300"], // Login deve ser rápido
        "http_req_duration{name:Products}": ["p(95)<1000"], // Produtos pode ser mais lento
        "http_req_duration{name:Cart}": ["p(95)<500"],

        // Thresholds de verificação granulares:
        "checks{check_name:Login com sucesso}": ["rate>0.99"], // Login deve ter 99% de sucesso
        "checks{check_name:Produtos carregados}": ["rate>0.95"],
        "checks{check_name:Carrinho carregado}": ["rate>0.99"],
      },
    };

    export default function () {
      // 1. Requisição de Login
      let resLogin = http.get("https://api.minha-loja.com/v2/login", {
        tags: { name: "Login" },
      });
      check(
        resLogin,
        { "Login com sucesso": (r) => r.status === 200 },
        { check_name: "Login com sucesso" }
      );

      // 2. Requisição de Produtos
      let resProducts = http.get("https://api.minha-loja.com/v2/products", {
        tags: { name: "Products" },
      });
      check(
        resProducts,
        { "Produtos carregados": (r) => r.status === 200 },
        { check_name: "Produtos carregados" }
      );

      // 3. Requisição do Carrinho
      let resCart = http.get("https://api.minha-loja.com/v2/cart", {
        tags: { name: "Cart" },
      });
      check(
        resCart,
        { "Carrinho carregado": (r) => r.status === 200 },
        { check_name: "Carrinho carregado" }
      );
    }
    `,
    `
    import http from 'k6/http';
    import { check } from 'k6';

    export default function () {
      const responses = http.batch([
        ['GET', 'https://test.k6.io', null, { tags: { ctype: 'html' } }],
        ['GET', 'https://test.k6.io/style.css', null, { tags: { ctype: 'css' } }],
        ['GET', 'https://test.k6.io/images/logo.png', null, { tags: { ctype: 'images' } }],
      ]);
      check(responses[0], {
        'main page status was 200': (res) => res.status === 200,
      });
    }
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
    {
      code: ` 
      import http from "k6/http";
      import { check } from "k6";

      export default function () {
        let r1 = http.get("https://quickpizza.grafana.com");
        check(r1, { "root ok 1": (r) => r.status === 200 });
        let r2 = http.get("https://quickpizza.grafana.com");
        check(r2, { "root ok 2": (r) => r.status === 200 });
      }
      `,
      errors: [{ messageId: "missingTags" }, { messageId: "missingTags" }],
    },
    {
      code: `
      import http from 'k6/http';

      export default function () {
        for (let id = 1; id <= 100; id++) {
          http.get('http://example.com/posts/\${id}');
        }
      }`,
      errors: [{ messageId: "missingTags" }],
    },
  ],
});

console.log("require-tags tests passed!");
