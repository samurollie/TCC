# ESLint Plugin K6 Performance

ESLint plugin for detecting performance issues in k6 test scripts.

<!-- ## Installation

```bash
npm install --save-dev eslint-plugin-k6-performance

```

## Usage

Add the plugin to your ESLint configuration:

```javascript
import k6Performance from "eslint-plugin-k6-performance";

export default [
  {
    files: ["k6-scripts/**/*.js"],
    plugins: {
      "k6-performance": k6Performance,
    },
    rules: {
      "k6-performance/no-heavy-init-context": "error",
    },
  },
];
```

Or use the recommended configuration:

```javascript
import k6Performance from "eslint-plugin-k6-performance";

export default [
  {
    files: ["k6-scripts/**/*.js"],
    ...k6Performance.configs.recommended,
  },
];
``` -->

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
