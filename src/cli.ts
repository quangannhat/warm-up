#!/usr/bin/env node

import { Argument, Command, Flag, Prompt } from "effect/cli"
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Console, Effect, FileSystem, Layer, Path, Schema } from "effect"
import { SqliteClient } from "@effect/sql-sqlite-node"
import { WorkspaceConfig } from "./config.js"
import { ProblemCatalog, problemStarterFiles, renderProblemReadme, renderProblemTestCases } from "./problems.js"
import { supportedLanguages, type SupportedLanguage } from "./scaffolds.js"
import { normalizeName, planDirectories } from "./structure.js"

class WorkspaceError extends Schema.TaggedError<WorkspaceError>()("WorkspaceError", {
  message: Schema.String
}) {}

const workspaceError = (cause: unknown) => {
  if (cause instanceof Error) return new WorkspaceError({ message: cause.message })
  if (typeof cause === "object" && cause !== null && "message" in cause && typeof cause.message === "string") {
    return new WorkspaceError({ message: cause.message })
  }
  return new WorkspaceError({ message: JSON.stringify(cause) ?? String(cause) })
}

const root = Flag.Path("root").pipe(Flag.withAlias("r"), Flag.withDefault("topics"))
const topic = Argument.String("topic")

const generateTopic = Effect.fn("generateTopic")(function* (root: string, topic: string, requestedLanguages?: ReadonlyArray<SupportedLanguage>) {
  const normalizedTopic = normalizeName(topic)

  if (!normalizedTopic) {
    return yield* new WorkspaceError({ message: "Topic must contain at least one letter or number." })
  }

  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const config = yield* WorkspaceConfig
  const catalog = yield* ProblemCatalog
  const configuredLanguages = yield* (requestedLanguages === undefined ? config.enabledLanguages() : config.allLanguages())
  const languageDefinitions = requestedLanguages === undefined
    ? configuredLanguages
    : configuredLanguages.filter(({ name }) => requestedLanguages.includes(name))
  if (languageDefinitions.length === 0) {
    return yield* new WorkspaceError({ message: "Select at least one supported language." })
  }
  const selectedLanguages = languageDefinitions.map(({ name }) => name)
  const directories = planDirectories(root, normalizedTopic, selectedLanguages, path.join)
  const problem = yield* catalog.get(normalizedTopic).pipe(
    Effect.catchTag("ProblemNotFound", () => Effect.void)
  )
  const topicDirectory = path.join(root, normalizedTopic)

  yield* fs.makeDirectory(topicDirectory, { recursive: true })
  if (problem !== undefined) {
    yield* fs.writeFileString(path.join(topicDirectory, "README.md"), renderProblemReadme(problem))
    yield* fs.writeFileString(path.join(topicDirectory, "test-cases.json"), renderProblemTestCases(problem))
  }

  yield* Console.log(
    `Created ${directories.length} language folder${directories.length === 1 ? "" : "s"} for ${normalizedTopic}${problem === undefined ? "" : " from the problem catalog"}:`
  )

  for (const [index, directory] of directories.entries()) {
    yield* fs.makeDirectory(directory, { recursive: true })
    const scaffold = languageDefinitions[index]!
    const starterFiles = problemStarterFiles(normalizedTopic, scaffold.name)

    for (const file of scaffold.files) {
      const filePath = path.join(directory, file.path)
      yield* fs.makeDirectory(path.dirname(filePath), { recursive: true })
      const starter = starterFiles.find(({ path: starterPath }) => starterPath === file.path)
      yield* fs.writeFileString(filePath, starter?.content ?? file.content)
    }

    yield* Console.log(`  ${directory} (${scaffold.run})`)
  }
})

const create = Command.make("create", { root, topic }, ({ root, topic }) =>
  generateTopic(root, topic).pipe(Effect.mapError(workspaceError))
)

const language = Argument.Literals("language", supportedLanguages)
const enable = Command.make("enable", { language }, ({ language }) =>
  Effect.gen(function* () {
    const config = yield* WorkspaceConfig
    yield* config.setLanguageEnabled(language, true)
    yield* Console.log(`Enabled ${language}`)
  })
)
const disable = Command.make("disable", { language }, ({ language }) =>
  Effect.gen(function* () {
    const config = yield* WorkspaceConfig
    yield* config.setLanguageEnabled(language, false)
    yield* Console.log(`Disabled ${language}`)
  })
)
const languages = Command.make("languages", {}, () =>
  Effect.gen(function* () {
    const config = yield* WorkspaceConfig
    const enabled = yield* config.enabledLanguages()
    yield* Console.log(enabled.map(({ name }) => `- ${name}`).join("\n") || "No languages enabled.")
  })
).pipe(Command.withSubcommands([enable, disable]))

const list = Command.make("list", { root }, ({ root }) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const rootExists = yield* fs.exists(root)

    if (!rootExists) {
      yield* Console.log("No topics yet.")
      return
    }

    const entries = yield* fs.readDirectory(root)
    const topics = yield* Effect.forEach(entries, (entry) =>
      Effect.gen(function* () {
        const info = yield* fs.stat(path.join(root, entry))
        return info.type === "Directory" ? entry : undefined
      })
    ).pipe(Effect.map((entries) => entries.filter((entry): entry is string => entry !== undefined).sort()))

    yield* Console.log(
      topics.length === 0 ? "No topics yet." : topics.map((topic) => `- ${topic}`).join("\n")
    )
  }).pipe(Effect.mapError(workspaceError))
)

const problemSlug = Argument.String("slug")
const problemList = Command.make("list", {}, () =>
  Effect.gen(function* () {
    const catalog = yield* ProblemCatalog
    const problems = yield* catalog.list()
    yield* Console.log(
      problems.length === 0
        ? "No problems yet."
        : problems.map(({ slug, title }) => `- ${slug}: ${title}`).join("\n")
    )
  })
).pipe(Command.withDescription("List stored problems"))

const problemShow = Command.make("show", { slug: problemSlug }, ({ slug }) =>
  Effect.gen(function* () {
    const catalog = yield* ProblemCatalog
    const problem = yield* catalog.get(slug)
    yield* Console.log(`${problem.title} (${problem.slug})`)
    yield* Console.log(`\n${problem.description}`)
    yield* Console.log(`\nConstraints: ${problem.constraints}`)
    yield* Console.log(`\nInput: ${problem.inputSchema}`)
    yield* Console.log(`Output: ${problem.outputSchema}`)

    for (const example of problem.examples) {
      yield* Console.log(`\nExample input: ${example.input}`)
      if (example.expectedOutput !== undefined) yield* Console.log(`Expected output: ${example.expectedOutput}`)
      if (example.explanation !== undefined) yield* Console.log(example.explanation)
    }
  }).pipe(Effect.mapError(workspaceError))
).pipe(Command.withDescription("Show a stored problem"))

const problemInput = Argument.String("input-json")
const problemOutput = Argument.String("output-json")
const problemValidate = Command.make("validate", { slug: problemSlug, input: problemInput, output: problemOutput }, ({ slug, input, output }) =>
  Effect.gen(function* () {
    const catalog = yield* ProblemCatalog
    yield* catalog.validate(slug, input, output)
    yield* Console.log("Valid solution.")
  }).pipe(Effect.mapError(workspaceError))
).pipe(Command.withDescription("Validate a JSON solution for a problem"))

const problems = Command.make("problems", {}, () =>
  Console.log("Use `warm-up problems list` to see stored problems.")
).pipe(Command.withSubcommands([problemList, problemShow, problemValidate]))

const interactive = Effect.gen(function* () {
  const catalog = yield* ProblemCatalog
  const config = yield* WorkspaceConfig
  const availableProblems = yield* catalog.list()

  if (availableProblems.length === 0) {
    yield* Console.log("No problems are available yet.")
    return
  }

  const selectedProblem = yield* Prompt.run(Prompt.Select({
    message: "Select a topic",
    choices: availableProblems.map((problem) => ({
      title: problem.title,
      value: problem.slug,
      description: problem.description
    }))
  }))
  const enabled = yield* config.enabledLanguages()
  const enabledNames = new Set(enabled.map(({ name }) => name))
  const selectedLanguages = yield* Prompt.run(Prompt.MultiSelect({
    message: "Select languages",
    min: 1,
    choices: supportedLanguages.map((language) => ({
      title: language,
      value: language,
      selected: enabledNames.has(language)
    }))
  }))

  yield* generateTopic("topics", selectedProblem, selectedLanguages).pipe(Effect.mapError(workspaceError))
})

const command = Command.make("warm-up", {}, () =>
  interactive
).pipe(Command.withSubcommands([create, list, languages, problems]))

const nodeLayer = NodeServices.layer
const sqliteLayer = SqliteClient.layer({ filename: ".warm-up.db" })
const configLayer = WorkspaceConfig.layer.pipe(Layer.provide(sqliteLayer))
const problemCatalogLayer = ProblemCatalog.layer.pipe(Layer.provide(sqliteLayer))

Command.run(command, { version: "0.1.0" }).pipe(
  Effect.provide(Layer.mergeAll(nodeLayer, sqliteLayer, configLayer, problemCatalogLayer)),
  NodeRuntime.runMain
)
