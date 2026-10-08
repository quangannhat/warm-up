import { describe, expect, it } from "@effect/vitest"
import * as Path from "node:path"
import { normalizeName, planDirectories } from "../src/structure.js"

describe("workspace structure", () => {
  it("normalizes topic and language names", () => {
    expect(normalizeName("Data Structures")).toBe("data-structures")
    expect(planDirectories("warmups", "Data Structures", ["TypeScript", "C++"], Path.join)).toEqual([
      "warmups/data-structures/typescript",
      "warmups/data-structures/c"
    ])
  })
})
