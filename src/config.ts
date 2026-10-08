import { Layer, Effect } from "effect"
import * as Context from "effect/Context"
import * as SqlClient from "effect/sql/SqlClient"
import { SqlError } from "effect/sql/SqlError"
import { defaultLanguages } from "./structure.js"
import { scaffolds, supportedLanguages, type Scaffold, type SupportedLanguage } from "./scaffolds.js"

export type LanguageDefinition = Scaffold & {
  readonly name: SupportedLanguage
}

type LanguageRow = {
  readonly name: SupportedLanguage
  readonly run_command: string
  readonly enabled: number
}

type TemplateRow = {
  readonly language: SupportedLanguage
  readonly path: string
  readonly content: string
}

export class WorkspaceConfig extends Context.Service<WorkspaceConfig, {
  readonly enabledLanguages: Effect.Effect<ReadonlyArray<LanguageDefinition>, SqlError>
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
          VALUES (${language}, ${scaffold.run}, ${defaultLanguages.includes(language as typeof defaultLanguages[number]) ? 1 : 0})
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

      const enabledLanguages = Effect.gen(function* () {
        const languages = yield* sql<LanguageRow>`
          SELECT name, run_command, enabled
          FROM languages
          WHERE enabled = 1
          ORDER BY name
        `

        return yield* Effect.forEach(languages, (language) =>
          sql<TemplateRow>`
            SELECT language, path, content
            FROM language_templates
            WHERE language = ${language.name}
            ORDER BY path
          `.pipe(
            Effect.map((templates) => ({
              name: language.name,
              run: language.run_command,
              files: templates.map(({ path, content }) => ({ path, content }))
            }))
          )
        )
      })

      const setLanguageEnabled = (language: SupportedLanguage, enabled: boolean) =>
        sql`
          UPDATE languages
          SET enabled = ${enabled ? 1 : 0}
          WHERE name = ${language}
        `.pipe(Effect.asVoid)

      return { enabledLanguages, setLanguageEnabled }
    })
  )
}
