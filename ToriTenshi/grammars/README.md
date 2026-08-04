# Tree-sitter grammars

Grammars are resolved automatically, in this order:

1. `audit.analysis.grammarsPath` (if set) — your own directory of `.wasm` files;
2. the **`tree-sitter-wasms`** package — an optional dependency that ships
   prebuilt WASM grammars (the WASM counterpart of the parser set maintained in
   the nvim-treesitter ecosystem). Installed automatically by `npm install`;
3. this bundled `grammars/` folder — drop `.wasm` files here to override.

The regex baseline in each analyzer always runs, so analysis keeps working even
when no grammar is available (grep-based flexibility is intentional).

Expected file names (see `src/analysis/WebTreeSitterEngine.ts`), matching the
`tree-sitter-wasms` naming: `tree-sitter-dockerfile.wasm`, `tree-sitter-yaml.wasm`,
`tree-sitter-hcl.wasm`, `tree-sitter-python.wasm`, `tree-sitter-javascript.wasm`,
`tree-sitter-typescript.wasm`, `tree-sitter-c.wasm`, `tree-sitter-cpp.wasm`,
`tree-sitter-html.wasm`.

Alternatives for sourcing grammars:
- `tree-sitter-wasms` (recommended, zero-effort): `npm install tree-sitter-wasms`.
- Build from a specific grammar package with the tree-sitter CLI:
  `npx tree-sitter build --wasm node_modules/tree-sitter-python -o grammars/tree-sitter-python.wasm`.
