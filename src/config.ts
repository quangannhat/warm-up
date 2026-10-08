import { Layer, Effect, Schema } from "effect"
import * as Context from "effect/Context"
import * as SqlClient from "effect/sql/SqlClient"
import { SqlError } from "effect/sql/SqlError"
import { scaffolds, supportedLanguages, SupportedLanguageSchema, type Scaffold, type SupportedLanguage } from "./scaffolds.js"

export type LanguageDefinition = Scaffold & {
  readonly name: SupportedLanguage
}

const LanguageRowSchema = Schema.Struct({
  name: SupportedLanguageSchema,
  run_command: Schema.String,
  enabled: Schema.Number
})

const TemplateRowSchema = Schema.Struct({
  language: SupportedLanguageSchema,
  path: Schema.String,
  content: Schema.String
})

export class WorkspaceConfig extends Context.Service<WorkspaceConfig, {
  readonly enabledLanguages: () => Effect.Effect<ReadonlyArray<LanguageDefinition>, SqlError | Schema.SchemaError>
  readonly allLanguages: () => Effect.Effect<ReadonlyArray<LanguageDefinition>, SqlError | Schema.SchemaError>
  readonly setLanguageEnabled: (language: SupportedLanguage, enabled: boolean) => Effect.Effect<void, SqlError>
}>()(
  "warm-up/WorkspaceConfig"
) {
  static readonly layer = Layer.effect(
    WorkspaceConfig,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      yield* sql`CREATE TABLE IF NOT EXISTS languages (
        name TEXT PRIMARY KEY NOT NULL,
        run_command TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0
      )`
      yield* sql`CREATE TABLE IF NOT EXISTS language_templates (
        language TEXT NOT NULL REFERENCES languages(name) ON DELETE CASCADE,
        path TEXT NOT NULL,
        content TEXT NOT NULL,
        PRIMARY KEY (language, path)
      )`
      yield* sql`CREATE TABLE IF NOT EXISTS topics (
        name TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`

      for (const language of supportedLanguages) {
        const scaffold = scaffolds[language]
        yield* sql`
          INSERT INTO languages (name, run_command, enabled)
          VALUES (${language}, ${scaffold.run}, 1)
          ON CONFLICT(name) DO NOTHING
        `

        for (const file of scaffold.files) {
          yield* sql`
            INSERT INTO language_templates (language, path, content)
            VALUES (${language}, ${file.path}, ${file.content})
            ON CONFLICT(language, path) DO NOTHING
          `
        }
      }

      // Retire languages removed from the built-in catalog while preserving their stored templates.
      yield* sql`
        UPDATE languages
        SET enabled = 0
        WHERE name NOT IN ('typescript', 'python', 'rust', 'elixir', 'go', 'c')
      `

      const loadLanguages = Effect.fn("WorkspaceConfig.loadLanguages")(function* (onlyEnabled: boolean) {
        const languages = yield* sql<Record<string, unknown>>`
          SELECT name, run_command, enabled
          FROM languages
          ${onlyEnabled ? sql`WHERE enabled = 1` : sql``}
          ORDER BY name
        `

        return yield* Effect.forEach(languages, (rawLanguage) => Effect.gen(function* () {
          const language = yield* Schema.decodeUnknownEffect(LanguageRowSchema)(rawLanguage)
          const rawTemplates = yield* sql<Record<string, unknown>>`
            SELECT language, path, content
            FROM language_templates
            WHERE language = ${language.name}
            ORDER BY path
          `
          const templates = yield* Effect.forEach(rawTemplates, (rawTemplate) =>
            Schema.decodeUnknownEffect(TemplateRowSchema)(rawTemplate)
          )

          return {
            name: language.name,
            run: language.run_command,
            files: templates.map(({ path, content }) => ({ path, content }))
          }
        }))
      })

      const enabledLanguages = () => loadLanguages(true)
      const allLanguages = () => loadLanguages(false)

      const setLanguageEnabled = Effect.fn("WorkspaceConfig.setLanguageEnabled")((language: SupportedLanguage, enabled: boolean) =>
        sql`
          UPDATE languages
          SET enabled = ${enabled ? 1 : 0}
          WHERE name = ${language}
        `.pipe(Effect.asVoid)
      )

      return { enabledLanguages, allLanguages, setLanguageEnabled }
    })
  )
}
