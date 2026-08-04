# Tree-sitter grammars

Place the WASM grammars here (or point `audit.analysis.grammarsPath` elsewhere).
Until a grammar is present, the matching analyzer falls back to its regex rules.

Expected file names (see `src/analysis/WebTreeSitterEngine.ts`):

| languageId | file                          |
| ---------- | ----------------------------- |
| dockerfile | tree-sitter-dockerfile.wasm   |
| yaml       | tree-sitter-yaml.wasm         |
| hcl        | tree-sitter-hcl.wasm          |
| python     | tree-sitter-python.wasm       |
| javascript | tree-sitter-javascript.wasm   |
| typescript | tree-sitter-typescript.wasm   |
| c          | tree-sitter-c.wasm            |
| cpp        | tree-sitter-cpp.wasm          |
| html       | tree-sitter-html.wasm         |

Fetching (example, requires network — done outside this repository):

```bash
# with the tree-sitter CLI, or by copying the prebuilt .wasm shipped by each grammar package
npx tree-sitter build --wasm node_modules/tree-sitter-python -o grammars/tree-sitter-python.wasm
```
