export type Scaffold = {
  readonly files: ReadonlyArray<{
    readonly path: string
    readonly content: string
  }>
  readonly run: string
}

export const supportedLanguages = [
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "shell"
] as const

export type SupportedLanguage = (typeof supportedLanguages)[number]

export const scaffolds: Record<SupportedLanguage, Scaffold> = {
  typescript: {
    files: [{ path: "main.ts", content: 'console.log("Hello from TypeScript")\n' }],
    run: "npx tsx main.ts"
  },
  javascript: {
    files: [{ path: "main.js", content: 'console.log("Hello from JavaScript")\n' }],
    run: "node main.js"
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
  shell: {
    files: [{ path: "main.sh", content: '#!/usr/bin/env bash\n\necho "Hello from shell"\n' }],
    run: "bash main.sh"
  }
}
