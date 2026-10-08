# warm-up

A small hand-written coding warm-up workspace, organized as:

```text
topics/<topic>/<language>/
```

## Usage

Install dependencies and build the CLI:

```sh
npm install
npm run build
```

Create a topic using the enabled languages stored in SQLite:

```sh
node dist/src/cli.js create data-structures
```

Inspect enabled languages:

```sh
./dist/src/cli.js languages
```

Enable or disable a language:

```sh
./dist/src/cli.js languages enable go
./dist/src/cli.js languages disable rust
```

Supported languages are `typescript`, `python`, `rust`, `elixir`, `go`, and `c`. Language templates and enabled state are stored in `.warm-up.db` through Effect SQL. The database layer initializes the language and `topics` tables before scaffolding starts.

Each language gets a runnable starter. For example, the generated files include `main.ts`, `main.py`, or a Rust Cargo project, and the CLI prints the command to run each one.

List topics:

```sh
node dist/src/cli.js list
```

After building, the CLI can also be run directly without npm or Bun:

```sh
./dist/src/cli.js create data-structures
```

By default, folders are created under `topics/`. Use `--root` to choose a different parent directory. Topic and language names are normalized to lowercase kebab-case. The CLI only creates folders; files remain yours to write by hand.
