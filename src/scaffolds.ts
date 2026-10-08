import { Schema } from "effect"

export type Scaffold = {
  readonly files: ReadonlyArray<{
    readonly path: string
    readonly content: string
  }>
  readonly run: string
}

export const supportedLanguages = [
  "typescript",
  "python",
  "rust",
  "elixir",
  "go",
  "c"
] as const

export type SupportedLanguage = (typeof supportedLanguages)[number]

export const SupportedLanguageSchema = Schema.Literals(supportedLanguages)

export const scaffolds: Record<SupportedLanguage, Scaffold> = {
  typescript: {
    files: [{ path: "main.ts", content: 'console.log("Hello from TypeScript")\n' }],
    run: "npx tsx main.ts"
  },
  python: {
    files: [{ path: "main.py", content: 'print("Hello from Python")\n' }],
    run: "python main.py"
  },
  rust: {
    files: [
      {
        path: "Cargo.toml",
        content: '[package]\nname = "warm_up"\nversion = "0.1.0"\nedition = "2021"\n'
      },
      { path: "src/main.rs", content: 'fn main() {\n    println!("Hello from Rust");\n}\n' }
    ],
    run: "cargo run"
  },
  elixir: {
    files: [{ path: "main.exs", content: 'IO.puts("Hello from Elixir")\n' }],
    run: "elixir main.exs"
  },
  go: {
    files: [
      {
        path: "go.mod",
        content: "module warm-up\n\ngo 1.22\n"
      },
      {
        path: "main.go",
        content: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello from Go")\n}\n'
      }
    ],
    run: "go run ."
  },
  c: {
    files: [{ path: "main.c", content: '#include <stdio.h>\n\nint main(void) {\n    puts("Hello from C");\n    return 0;\n}\n' }],
    run: "cc main.c -o main && ./main"
  }
}
