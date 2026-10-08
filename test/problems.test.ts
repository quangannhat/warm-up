import { describe, expect, it } from "@effect/vitest"
import { Effect, Result } from "effect"
import { validateTwoSum } from "../src/problems.js"

const run = (input: unknown, output: unknown) => Effect.result(validateTwoSum(input, output))

describe("problem validators", () => {
  it.effect("accepts the Two Sum example", () =>
    Effect.gen(function* () {
      const result = yield* run({ nums: [2, 7, 11, 15], target: 9 }, [0, 1])
      expect(Result.isSuccess(result)).toBe(true)
    })
  )

  it.effect("rejects an invalid input shape", () =>
    Effect.gen(function* () {
      const result = yield* run({ nums: [2, "7"], target: 9 }, [0, 1])
      expect(Result.isFailure(result)).toBe(true)
    })
  )

  it.effect("rejects a reused index", () =>
    Effect.gen(function* () {
      const result = yield* run({ nums: [3, 3], target: 6 }, [0, 0])
      expect(Result.isFailure(result)).toBe(true)
    })
  )

  it.effect("rejects a pair that does not reach the target", () =>
    Effect.gen(function* () {
      const result = yield* run({ nums: [2, 7, 11, 15], target: 9 }, [0, 2])
      expect(Result.isFailure(result)).toBe(true)
    })
  )

  it.effect("rejects inputs without exactly one solution", () =>
    Effect.gen(function* () {
      const result = yield* run({ nums: [3, 3, 3], target: 6 }, [0, 1])
      expect(Result.isFailure(result)).toBe(true)
    })
  )
})
