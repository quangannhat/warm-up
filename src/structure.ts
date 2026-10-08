export const normalizeName = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

export const planDirectories = (
  root: string,
  topic: string,
  languages: ReadonlyArray<string>,
  join: (root: string, topic: string, language: string) => string
): ReadonlyArray<string> => {
  const normalizedTopic = normalizeName(topic)
  const normalizedLanguages = languages.map(normalizeName).filter(Boolean)

  return normalizedLanguages.map((language) =>
    join(root, normalizedTopic, language)
  )
}
