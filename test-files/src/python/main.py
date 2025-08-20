import subprocess
import json

SCRIPT_PATH = "../js/index.js"
CODE = "../js/code.js"

with open(CODE, "r") as file:
    js_code = file.read()
    results = subprocess.run(
        ["node", SCRIPT_PATH, js_code], capture_output=True, text=True
    )  # Executa o arquivo

data = json.loads(results.stdout)

# Salva tokens em tokens.json
with open("tokens.json", "w") as f_tokens:
    f_tokens.write(json.dumps(data["tokens"], indent=2))

# Salva ast em tree.json
with open("tree.json", "w") as f_tree:
    f_tree.write(json.dumps(data["ast"], indent=2))

with open("result.json", "w") as file:  # Salva o output em result.json
    file.write(results.stdout)
    file.close()
