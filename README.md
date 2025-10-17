# ESLint Plugin K6 Performance

ESLint plugin for detecting performance issues in k6 test scripts.

## Installation

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
```

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

Run ESLint (lint only) on k6 scripts:

```bash
npm run test:eslint
```

Run all checks (build + unit tests + ESLint):

```bash
npm run test:all
```
