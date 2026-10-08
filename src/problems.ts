import { Effect, Layer, Schema } from "effect"
import * as Context from "effect/Context"
import * as SqlClient from "effect/sql/SqlClient"
import { SqlError } from "effect/sql/SqlError"
import type { SupportedLanguage } from "./scaffolds.js"

export type ProblemExample = {
  readonly input: string
  readonly expectedOutput: string | undefined
  readonly explanation: string | undefined
}

export type Problem = {
  readonly slug: string
  readonly title: string
  readonly description: string
  readonly constraints: string
  readonly inputSchema: string
  readonly outputSchema: string
  readonly validatorKey: string
  readonly examples: ReadonlyArray<ProblemExample>
}

export const renderProblemReadme = (problem: Problem): string => {
  const examples = problem.examples.map((example) => [
    "### Input",
    "```json",
    example.input,
    "```",
    ...(example.expectedOutput === undefined ? [] : ["", "### Expected output", "```json", example.expectedOutput, "```"]),
    ...(example.explanation === undefined ? [] : ["", example.explanation])
  ].join("\n")).join("\n\n")

  return `# ${problem.title}

${problem.description}

## Input

${problem.inputSchema}

## Output

${problem.outputSchema}

## Requirements

${problem.constraints}

## Examples

${examples}
`
}

export const renderProblemTestCases = (problem: Problem): string => {
  const cases = problem.examples.map(({ input, expectedOutput }) =>
    `  { "input": ${input}, "expectedOutput": ${expectedOutput ?? "null"} }`
  )
  return `[\n${cases.join(",\n")}\n]\n`
}

export const problemStarterFiles = (slug: string, language: SupportedLanguage): ReadonlyArray<{ readonly path: string; readonly content: string }> => {
  if (slug !== "two-sum") return []

  const starters: Record<SupportedLanguage, ReadonlyArray<{ readonly path: string; readonly content: string }>> = {
    typescript: [{
      path: "main.ts",
      content: `export const twoSum = (nums: number[], target: number): [number, number] => {\n  throw new Error("Not implemented")\n}\n`
    }],
    python: [{
      path: "main.py",
      content: `def two_sum(nums: list[int], target: int) -> tuple[int, int]:\n    raise NotImplementedError\n`
    }],
    rust: [{
      path: "src/main.rs",
      content: `fn two_sum(nums: &[i32], target: i32) -> (usize, usize) {\n    todo!()\n}\n\nfn main() {}\n`
    }],
    elixir: [{
      path: "main.exs",
      content: `defmodule TwoSum do\n  def two_sum(_nums, _target) do\n    raise "Not implemented"\n  end\nend\n`
    }],
    go: [{
      path: "main.go",
      content: `package main\n\nfunc twoSum(nums []int, target int) [2]int {\n\tpanic("not implemented")\n}\n\nfunc main() {}\n`
    }],
    c: [{
      path: "main.c",
      content: `#include <stddef.h>\n\nstruct pair { size_t first; size_t second; };\n\nstruct pair two_sum(const int *nums, size_t length, int target) {\n    (void) nums;\n    (void) length;\n    (void) target;\n    return (struct pair) {0, 0};\n}\n\nint main(void) { return 0; }\n`
    }]
  }

  return starters[language] ?? []
}

export class ProblemNotFound extends Schema.TaggedError<ProblemNotFound>()("ProblemNotFound", {
  slug: Schema.String
}) {}

export class ProblemValidationError extends Schema.TaggedError<ProblemValidationError>()("ProblemValidationError", {
  message: Schema.String
}) {}

type Validator = (input: unknown, output: unknown) => Effect.Effect<void, ProblemValidationError>

const TwoSumInputSchema = Schema.Struct({
  nums: Schema.Array(Schema.Int),
  target: Schema.Int
})

type TwoSumInput = typeof TwoSumInputSchema.Type
const TwoSumOutputSchema = Schema.Array(Schema.Int)
type TwoSumOutput = typeof TwoSumOutputSchema.Type

const decodeInput = (value: unknown) =>
  Schema.decodeUnknownEffect(TwoSumInputSchema)(value).pipe(
    Effect.mapError(() => new ProblemValidationError({ message: "Input has an invalid shape." }))
  )

const decodeOutput = (value: unknown) =>
  Schema.decodeUnknownEffect(TwoSumOutputSchema)(value).pipe(
    Effect.mapError(() => new ProblemValidationError({ message: "Output has an invalid shape." }))
  )

export const validateTwoSum: Validator = (rawInput, rawOutput) =>
  Effect.gen(function* () {
    const input: TwoSumInput = yield* decodeInput(rawInput)
    const output: TwoSumOutput = yield* decodeOutput(rawOutput)

    if (input.nums.length < 2 || input.nums.length > 10_000) {
      return yield* new ProblemValidationError({
        message: "nums must contain between 2 and 10,000 integers."
      })
    }

    if (input.nums.some((value) => value < -1_000_000_000 || value > 1_000_000_000)) {
      return yield* new ProblemValidationError({
        message: "Each nums value must be between -1,000,000,000 and 1,000,000,000."
      })
    }

    if (input.target < -1_000_000_000 || input.target > 1_000_000_000) {
      return yield* new ProblemValidationError({
        message: "target must be between -1,000,000,000 and 1,000,000,000."
      })
    }

    let solutionCount = 0
    for (let left = 0; left < input.nums.length; left++) {
      for (let right = left + 1; right < input.nums.length; right++) {
        if (input.nums[left]! + input.nums[right]! === input.target) solutionCount += 1
      }
    }

    if (solutionCount !== 1) {
      return yield* new ProblemValidationError({
        message: "The input must contain exactly one valid pair."
      })
    }

    if (output.length !== 2) {
      return yield* new ProblemValidationError({
        message: "Output must contain exactly two indices."
      })
    }

    const [left, right] = output
    if (left === undefined || right === undefined || left < 0 || right < 0 || left >= input.nums.length || right >= input.nums.length) {
      return yield* new ProblemValidationError({ message: "Output indices are out of bounds." })
    }

    if (left === right) {
      return yield* new ProblemValidationError({ message: "Output indices must be different." })
    }

    if (input.nums[left]! + input.nums[right]! !== input.target) {
      return yield* new ProblemValidationError({ message: "The selected values do not sum to target." })
    }
  })

const validators: Record<string, Validator> = {
  "two-sum": validateTwoSum
}

const initialProblems = [{
  slug: "two-sum",
  title: "Two Sum",
  description: "Given an array of integers nums and an integer target, return the indices of the two numbers that add up to target.",
  constraints: "nums has 2-10,000 integers; each value and target are between -1,000,000,000 and 1,000,000,000; exactly one valid pair exists; an element may not be used twice.",
  inputSchema: JSON.stringify({ nums: "integer[]", target: "integer" }),
  outputSchema: JSON.stringify("integer[2]"),
  validatorKey: "two-sum",
  examples: [
    {
      input: JSON.stringify({ nums: [2, 7, 11, 15], target: 9 }),
      expectedOutput: JSON.stringify([0, 1]),
      explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
    }
  ]
}] as const

const ProblemRowSchema = Schema.Struct({
  slug: Schema.String,
  title: Schema.String,
  description: Schema.String,
  constraints: Schema.String,
  inputSchema: Schema.String,
  outputSchema: Schema.String,
  validatorKey: Schema.String
})

const ExampleRowSchema = Schema.Struct({
  input: Schema.String,
  expected_output: Schema.NullOr(Schema.String),
  explanation: Schema.NullOr(Schema.String)
})

type ProblemRow = typeof ProblemRowSchema.Type
type ExampleRow = typeof ExampleRowSchema.Type

const readProblem = (row: ProblemRow, examples: ReadonlyArray<ExampleRow>): Problem => ({
  slug: row.slug,
  title: row.title,
  description: row.description,
  constraints: row.constraints,
  inputSchema: row.inputSchema,
  outputSchema: row.outputSchema,
  validatorKey: row.validatorKey,
  examples: examples.map(({ input, expected_output, explanation }) => ({
    input,
    expectedOutput: expected_output ?? undefined,
    explanation: explanation ?? undefined
  }))
})

export class ProblemCatalog extends Context.Service<ProblemCatalog, {
  readonly list: () => Effect.Effect<ReadonlyArray<Problem>, SqlError | Schema.SchemaError>
  readonly get: (slug: string) => Effect.Effect<Problem, SqlError | Schema.SchemaError | ProblemNotFound>
  readonly validate: (slug: string, inputJson: string, outputJson: string) => Effect.Effect<void, SqlError | Schema.SchemaError | ProblemNotFound | ProblemValidationError>
}>()(
  "warm-up/ProblemCatalog"
) {
  static readonly layer = Layer.effect(
    ProblemCatalog,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      yield* sql`CREATE TABLE IF NOT EXISTS problems (
        slug TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        input_schema TEXT NOT NULL,
        output_schema TEXT NOT NULL,
        validator_key TEXT NOT NULL
      )`
      const columns = yield* sql<{ readonly name: string }>`PRAGMA table_info(problems)`
      if (!columns.some(({ name }) => name === "constraints")) {
        yield* sql`ALTER TABLE problems ADD COLUMN constraints TEXT NOT NULL DEFAULT ''`
      }
      yield* sql`CREATE TABLE IF NOT EXISTS problem_examples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        problem_slug TEXT NOT NULL REFERENCES problems(slug) ON DELETE CASCADE,
        input TEXT NOT NULL,
        expected_output TEXT,
        explanation TEXT
      )`

      for (const problem of initialProblems) {
        yield* sql`
          INSERT INTO problems (slug, title, description, constraints, input_schema, output_schema, validator_key)
          VALUES (${problem.slug}, ${problem.title}, ${problem.description}, ${problem.constraints}, ${problem.inputSchema}, ${problem.outputSchema}, ${problem.validatorKey})
          ON CONFLICT(slug) DO UPDATE SET constraints =
            CASE WHEN problems.constraints = '' THEN excluded.constraints ELSE problems.constraints END
        `

        for (const example of problem.examples) {
          yield* sql`
            INSERT INTO problem_examples (problem_slug, input, expected_output, explanation)
            SELECT ${problem.slug}, ${example.input}, ${example.expectedOutput}, ${example.explanation}
            WHERE NOT EXISTS (
              SELECT 1 FROM problem_examples
              WHERE problem_slug = ${problem.slug} AND input = ${example.input}
            )
          `
        }
      }

      const find = (slug: string) =>
        Effect.gen(function* () {
          const rows = yield* sql<Record<string, unknown>>`
            SELECT slug, title, description,
              constraints,
              input_schema AS "inputSchema",
              output_schema AS "outputSchema",
              validator_key AS "validatorKey"
            FROM problems
            WHERE slug = ${slug}
          `
          const rawRow = rows[0]
          if (rawRow === undefined) return yield* new ProblemNotFound({ slug })
          const row = yield* Schema.decodeUnknownEffect(ProblemRowSchema)(rawRow)

          const rawExamples = yield* sql<Record<string, unknown>>`
            SELECT input, expected_output, explanation
            FROM problem_examples
            WHERE problem_slug = ${slug}
            ORDER BY id
          `
          const examples = yield* Effect.forEach(rawExamples, (rawExample) =>
            Schema.decodeUnknownEffect(ExampleRowSchema)(rawExample)
          )
          return readProblem(row, examples)
        })

      const list = Effect.fn("ProblemCatalog.list")(function* () {
        const rows = yield* sql<Record<string, unknown>>`
          SELECT slug, title, description,
            constraints,
            input_schema AS "inputSchema",
            output_schema AS "outputSchema",
            validator_key AS "validatorKey"
          FROM problems
          ORDER BY title
        `
        return yield* Effect.forEach(rows, (rawRow) => Effect.gen(function* () {
          const row = yield* Schema.decodeUnknownEffect(ProblemRowSchema)(rawRow)
          const rawExamples = yield* sql<Record<string, unknown>>`
            SELECT input, expected_output, explanation
            FROM problem_examples
            WHERE problem_slug = ${row.slug}
            ORDER BY id
          `
          const examples = yield* Effect.forEach(rawExamples, (rawExample) =>
            Schema.decodeUnknownEffect(ExampleRowSchema)(rawExample)
          )
          return readProblem(row, examples)
        }))
      })

      const get = Effect.fn("ProblemCatalog.get")(find)

      const parseJson = (value: string, label: string) =>
        Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))(value).pipe(
          Effect.mapError(() => new ProblemValidationError({ message: `${label} must be valid JSON.` }))
        )

      const validate = Effect.fn("ProblemCatalog.validate")(function* (slug: string, inputJson: string, outputJson: string) {
        const problem = yield* find(slug)
        const validator = validators[problem.validatorKey]
        if (validator === undefined) {
          return yield* new ProblemValidationError({ message: `No validator registered for ${slug}.` })
        }
        const input = yield* parseJson(inputJson, "Input")
        const output = yield* parseJson(outputJson, "Output")
        yield* validator(input, output)
      })

      return { list, get, validate }
    })
  )
}
