# ESLint Plugin K6 Performance

ESLint plugin for detecting performance issues in k6 test scripts.

## Rules

### `no-heavy-init-context`

Disallows heavy operations in k6 init context that can impact performance.

❌ **Incorrect:**

```javascript
import { open } from "k6";

// Heavy operations in init context
const largeDataFile = open("./large-data.json");
const testData = JSON.parse(largeDataFile);

export default function () {
  // test logic
}
```

✅ **Correct:**

```javascript
import { SharedArray } from "k6/data";

// Use SharedArray for shared data
const testData = new SharedArray("test-data", function () {
  const data = open("./large-data.json");
  return JSON.parse(data);
});

export default function () {
  // test logic using testData
}
```

### `require-tags`

Garante que cada requisição HTTP em um script k6 tenha `tags` (útil para identificar requests em métricas e relatórios).

❌ Incorrect:

```javascript
import http from "k6/http";

export default function () {
  http.get("https://example.com/api");
}
```

✅ Correct:

```javascript
import http from "k6/http";

export default function () {
  http.get("https://example.com/api", null, { tags: { endpoint: "api" } });
}
```

### `require-check`

Detecta quando o script executa requisições HTTP em testes sem realizar `check()` nas respostas — checagens ajudam a validar comportamento funcional durante o load test.

❌ Incorrect:

```javascript
import http from "k6/http";

export default function () {
  http.get("https://example.com/");
}
```

✅ Correct:

```javascript
import http from "k6/http";
import { check } from "k6";

export default function () {
  const r = http.get("https://example.com/");
  check(r, { "status is 200": (res) => res.status === 200 });
}
```

### `require-thresholds`

Verifica se a exportação `options` contém `thresholds` não vazios. Scripts de performance devem definir thresholds para estabelecer critérios de qualidade e evitar resultados ambíguos.

Esta regra considera violação casos onde `options` não contém `thresholds` ou quando `thresholds` existe mas está vazio/sem regras literais.

❌ Incorrect (sem thresholds):

```javascript
export const options = {
  vus: 50,
  duration: "30s",
};

export default function () {
  /* ... */
}
```

❌ Incorrect (thresholds vazio):

```javascript
export const options = {
  vus: 10,
  thresholds: {},
};
```

✅ Correct:

```javascript
export const options = {
  vus: 20,
  thresholds: {
    http_req_duration: ["p(95) < 500"],
  },
};
```

> Observação: a regra tenta detectar padrões literais comuns (`export const`, `module.exports =`, `exports.options =`, `export { options }`). Casos dinâmicos complexos (thresholds construídos em tempo de execução) podem requerer revisão manual.

## Development

Build the plugin:

```bash
npm run build
```

Test the plugin:

```bash
npm test
```

Run ESLint (lint only) on `k6-scripts`:

```bash
npm run lint
```

Run all checks (build + unit tests + ESLint):

```bash
npm run test:all
```

## Scan de repositórios

<!-- Na pasta `scripts` -->

Este repositório contém um script de varredura que lê `k6-scripts/repositorios_k6.csv`, clona os repositórios listados, executa o ESLint (forçando o uso do plugin local) sobre os arquivos k6 indicados e gera um relatório CSV `k6-lint-results.csv`.

Como usar:

- Modo preview (não clona repositórios; simula a execução):

```bash
node scripts/scan-repos.js --preview --limit 10
```

- Scan real (clona e remove repositórios ao final):

```bash
node scripts/scan-repos.js --limit 5
```

- Scan real preservando os repositórios clonados (útil para depuração):

```bash
node scripts/scan-repos.js --limit 5 --keep-repos
```

Atalhos/aliases disponíveis:

- `-p` é equivalente a `--preview`
- `-l` é equivalente a `--limit`
- `-k` é equivalente a `--keep-repos`

Opções:

- `--preview` : simula o processo sem clonar. (alias `-p`)
- `--limit N` : processa apenas os primeiros N repositórios do CSV. (alias `-l`, deve ser inteiro >= 1)
- `--keep-repos` : não apaga `temp/repos` ao final do scan. (alias `-k`)
- `--verbose` : exibe logs verbosos sobre remoções de arquivos e diretórios durante o scan. (alias `-v`)
- `--summary` : imprime uma linha concisa por arquivo/repositório com o resumo de problemas encontrados (útil para logs rápidos).
- `--debug` : ativa modo debug — equivale a `--verbose` mais dump completo dos resultados do ESLint (útil para investigação profunda).

O relatório `k6-lint-results.csv` contém as colunas: `repositório`, `url`, `arquivo`, `file_exists`, `clone_error` e uma coluna para cada regra do plugin indicando o número de ocorrências encontradas.
