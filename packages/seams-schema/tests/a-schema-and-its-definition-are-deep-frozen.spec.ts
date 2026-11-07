import { describe, expect, it } from 'vitest'

import { schema } from '../src/index'

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null

const levelsOf = (value: unknown): unknown[] => (isRecord(value) ? [value, ...Object.values(value).flatMap(levelsOf)] : [])

describe('a schema and its definition are deep-frozen', () => {
  it("the returned schema, its definition and every nested level are frozen, and the caller's definition is not (rejects a shallow freeze, and a freeze of the caller's value)", () => {
    const callers = {
      type: 'object',
      shape: { list: { type: 'array', items: { type: 'object', shape: { name: { type: 'string', minLength: 1 } } } } },
    } as const
    const subject = schema(callers)

    expect(Object.isFrozen(subject)).toBe(true)
    expect(subject.definition).not.toBe(callers)
    expect(subject.definition).toStrictEqual(callers)
    expect(levelsOf(subject.definition).filter(level => !Object.isFrozen(level))).toStrictEqual([])
    expect(levelsOf(callers).filter(level => Object.isFrozen(level))).toStrictEqual([])
  })
})
