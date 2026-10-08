import { describe, it } from "node:test"
import { deepStrictEqual, strictEqual } from "node:assert"
import * as Path from "node:path"
import { normalizeName, planDirectories } from "../src/structure.js"

describe("workspace structure", () => {
  it("normalizes topic and language names", () => {
    strictEqual(normalizeName("Data Structures"), "data-structures")
    deepStrictEqual(planDirectories("warmups", "Data Structures", ["TypeScript", "C++"], Path.join), [
      "warmups/data-structures/typescript",
      "warmups/data-structures/c"
    ])
  })
})
