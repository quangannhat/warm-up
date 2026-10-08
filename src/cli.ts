#!/usr/bin/env node

import { Argument, Command, Flag } from "effect/cli"
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Console, Effect, FileSystem, Layer, Path, Schema } from "effect"
import { SqliteClient } from "@effect/sql-sqlite-node"
import { WorkspaceConfig } from "./config.js"
import { supportedLanguages } from "./scaffolds.js"
import { normalizeName, planDirectories } from "./structure.js"

class WorkspaceError extends Schema.TaggedError<WorkspaceError>()("WorkspaceError", {
  message: Schema.String
}) {}

const root = Flag.Path("root").pipe(Flag.withAlias("r"), Flag.withDefault("topics"))
const topic = Argument.String("topic")

const create = Command.make("create", { root, topic }, ({ root, topic }) => {
  const normalizedTopic = normalizeName(topic)

  if (!normalizedTopic) {
    return Effect.fail(new WorkspaceError({ message: "Topic must contain at least one letter or number." }))
  }

  return Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const config = yield* WorkspaceConfig
    const languageDefinitions = yield* config.enabledLanguages
    const selectedLanguages = languageDefinitions.map(({ name }) => name)
    const directories = planDirectories(root, normalizedTopic, selectedLanguages, path.join)

    yield* Console.log(
      `Created ${directories.length} language folder${directories.length === 1 ? "" : "s"} for ${normalizedTopic}:`
    )

    for (const [index, directory] of directories.entries()) {
      yield* fs.makeDirectory(directory, { recursive: true })
      const scaffold = languageDefinitions[index]!

      for (const file of scaffold.files) {
        const filePath = path.join(directory, file.path)
        yield* fs.makeDirectory(path.dirname(filePath), { recursive: true })
        yield* fs.writeFileString(filePath, file.content)
      }

      yield* Console.log(`  ${directory} (${scaffold.run})`)
    }
  }).pipe(Effect.mapError((cause) => new WorkspaceError({ message: String(cause) })))
})

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
    const enabled = yield* config.enabledLanguages
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
  }).pipe(Effect.mapError((cause) => new WorkspaceError({ message: String(cause) })))
)

const command = Command.make("warm-up", {}, () =>
  Console.log("Use `warm-up create <topic>` to scaffold a topic with enabled languages.")
).pipe(Command.withSubcommands([create, list, languages]))

const nodeLayer = NodeServices.layer
const sqliteLayer = SqliteClient.layer({ filename: ".warm-up.db" })
const configLayer = WorkspaceConfig.layer.pipe(Layer.provide(sqliteLayer))

Command.run(command, { version: "0.1.0" }).pipe(
  Effect.provide(Layer.mergeAll(nodeLayer, sqliteLayer, configLayer)),
  NodeRuntime.runMain
)
