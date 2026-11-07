import { describe, expect, expectTypeOf, it } from 'vitest'

import { type Definition, schema, SchemaError } from '../src/index'

const isDefinitionShaped = (value: unknown): value is Definition => typeof value === 'object'

const untyped = (value: unknown): Definition => {
  if (isDefinitionShaped(value)) return value
  throw new TypeError('a definition fixture must be an object')
}

const thrownBy = (run: () => unknown): unknown => {
  try {
    run()
  } catch (error) {
    return error
  }
  return undefined
}

const refusalOf = (definition: unknown): unknown => thrownBy(() => schema(untyped(definition)))

const anything = { type: 'unknown', because: 'the value is opaque' } as const

const bareUnknown = anything
const recordOfUnknown = { type: 'record', values: anything } as const
const keyedRecordOfUnknown = { type: 'record', values: anything, keys: { type: 'string', pattern: '^[a-z]+$' } } as const
const arrayOfUnknown = { type: 'array', items: anything } as const
const keylessObjectWithUnknownRest = { type: 'object', shape: {}, rest: anything } as const
const unionWithRecordOfUnknown = { type: 'union', members: [{ type: 'string' }, recordOfUnknown] } as const
const refToUnknown = { type: 'ref', name: 'Anything', definitions: { Anything: anything } } as const
const recordOfRefToUnknown = { type: 'record', values: { type: 'ref', name: 'Anything' }, definitions: { Anything: anything } } as const

const wholeUnknown = [{ path: [], message: 'invalid definition: a whole parameter schema cannot be unknown: declare its keys' }]

describe('a whole parameter schema cannot be unknown', () => {
  it("each whole-unknown root throws 'invalid definition: a whole parameter schema cannot be unknown: declare its keys' at the root path (rejects a check that reads only the root node)", () => {
    expect(refusalOf(bareUnknown)).toBeInstanceOf(SchemaError)
    expect(refusalOf(bareUnknown)).toMatchObject({ issues: wholeUnknown })
    expect(refusalOf(recordOfUnknown)).toMatchObject({ issues: wholeUnknown })
    expect(refusalOf(keyedRecordOfUnknown)).toMatchObject({ issues: wholeUnknown })
    expect(refusalOf(arrayOfUnknown)).toMatchObject({ issues: wholeUnknown })
    expect(refusalOf(keylessObjectWithUnknownRest)).toMatchObject({ issues: wholeUnknown })
    expect(refusalOf(unionWithRecordOfUnknown)).toMatchObject({ issues: wholeUnknown })
    expect(refusalOf(refToUnknown)).toMatchObject({ issues: wholeUnknown })
    expect(refusalOf(recordOfRefToUnknown)).toMatchObject({ issues: wholeUnknown })
  })

  it('each whole-unknown root is a compile error (rejects a type that admits a whole-unknown root)', () => {
    expectTypeOf<Parameters<typeof schema<typeof bareUnknown>>[0]>().toBeNever()
    expectTypeOf<Parameters<typeof schema<typeof recordOfUnknown>>[0]>().toBeNever()
    expectTypeOf<Parameters<typeof schema<typeof keyedRecordOfUnknown>>[0]>().toBeNever()
    expectTypeOf<Parameters<typeof schema<typeof arrayOfUnknown>>[0]>().toBeNever()
    expectTypeOf<Parameters<typeof schema<typeof keylessObjectWithUnknownRest>>[0]>().toBeNever()
    expectTypeOf<Parameters<typeof schema<typeof unionWithRecordOfUnknown>>[0]>().toBeNever()
    expectTypeOf<Parameters<typeof schema<typeof refToUnknown>>[0]>().toBeNever()
    expectTypeOf<Parameters<typeof schema<typeof recordOfRefToUnknown>>[0]>().toBeNever()
  })

  it('unknown inside a declared key is accepted (rejects a check that refuses every unknown)', () => {
    const declared = schema({ type: 'object', shape: { payload: { type: 'unknown', because: 'the payload is forwarded unread' } } })

    expect(declared.parse({ payload: [1, 'two'] })).toStrictEqual({ payload: [1, 'two'] })
  })
})
