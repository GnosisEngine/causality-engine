# Forge: TypeScript

A lean TypeScript project template with hot reload, path aliases, testing, coverage, and a pre-commit lint/test hook.

## Using this template

### As a starting point for a new project

```bash
npx degit PsySecGroup/forge-typescript my-project
cd my-project
nvm use
npm install
```

Then update `package.json` with your project's name, description, version, repository, bugs, and homepage fields before doing anything else.

Remove the example files and write your own:

```bash
rm src/math.ts tests/index.test.ts
```

`src/index.ts` is your barrel file — keep it, but clear its exports and repopulate as you build out your own modules.

### On GitHub

Click [**Use this template**](https://github.com/new?template_name=forge-typescript&template_owner=PsySecGroup) at the top of the repository page to create a new repo with this structure and no git history.

---

## Development

### Requirements

- Node `>=22.12.0` (see `.nvmrc`)
- nvm

### Setup

```bash
nvm use
npm install
```

### Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start hot-reload dev server |
| `npm run build` | Type-check and compile to `dist/` |
| `npm run lint` | Type-check without emitting |
| `npm test` | Run test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

### Project structure

```
src/            Source files
  index.ts      Barrel — manually curate public exports here
  types.d.ts    Global type declarations
tests/          Unit tests (mirrors src/ structure)
dist/           Compiled output (generated, not committed)
coverage/       Coverage report (generated, not committed)
.husky/         Git hooks
.vscode/        Shared editor settings
```

### Path aliases

Import from anywhere using `@/` as the `src/` root:

```ts
import { something } from '@/module.js'
```

Note the `.js` extension is required even for `.ts` files — this is a `NodeNext` module resolution requirement.

### Adding a new module

1. Create `src/your-module.ts`
2. Write and export your functions
3. Add a corresponding `tests/your-module.test.ts`
4. Re-export from `src/index.ts` if it's part of the public API:
  ```ts
  export { yourFunction } from './your-module.js'
  ```

### Pre-commit hook

Husky runs `lint` and `test` on every commit. If either fails the commit is blocked. Fix the errors and try again — don't bypass with `--no-verify` unless you have a very good reason.

---

## Maintaining this template

### Making changes

Clone the repo, make your changes, verify the full pipeline works:

```bash
npm run lint && npm test && npm run build
```

Then commit — the pre-commit hook will run automatically.

### Updating dependencies

```bash
npm update
npm run lint && npm test
```

If major version bumps break anything, resolve before committing `package-lock.json`.

### Node version

The required Node version is set in three places — keep them in sync when upgrading:

- `.nvmrc`
- `package.json` → `engines.node`
- This README