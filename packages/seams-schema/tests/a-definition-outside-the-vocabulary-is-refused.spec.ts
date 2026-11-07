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

const invalid = (): unknown => expect.stringMatching(/^invalid definition: /)

const containing = (...items: unknown[]): unknown => expect.arrayContaining(items)

describe('a definition outside the vocabulary is refused', () => {
  it('a definition with an unknown option throws SchemaError naming the option (rejects a meta-schema that strips unknown options)', () => {
    const atRoot = refusalOf({ type: 'object', shape: {}, strict: true })
    const deep = refusalOf({ type: 'object', shape: { a: { type: 'object', shape: { b: { type: 'string', strict: true } } } } })

    expect(atRoot).toBeInstanceOf(SchemaError)
    expect(atRoot).toMatchObject({ issues: [{ path: [], message: 'invalid definition: Unrecognized key: "strict"' }] })
    expect(deep).toMatchObject({ issues: containing({ path: ['shape', 'a', 'shape', 'b'], message: invalid() }) })
  })

  it('an unknown option is a compile error at the literal (rejects a generic that skips excess-property checks)', () => {
    const atRoot = { type: 'object', shape: {}, strict: true } as const
    const deep = { type: 'object', shape: { a: { type: 'object', shape: { b: { type: 'string', strict: true } } } } } as const

    expectTypeOf<Parameters<typeof schema<typeof atRoot>>[0]>().toBeNever()
    expectTypeOf<Parameters<typeof schema<typeof deep>>[0]>().toBeNever()
  })

  it('unknown without because, or with a blank because, is refused (rejects an unknown with no stated reason)', () => {
    const missing = refusalOf({ type: 'object', shape: { a: { type: 'unknown' } } })
    const blank = refusalOf({ type: 'object', shape: { a: { type: 'unknown', because: '  ' } } })

    expect(missing).toBeInstanceOf(SchemaError)
    expect(missing).toMatchObject({ issues: containing(expect.objectContaining({ message: invalid() })) })
    expect(blank).toMatchObject({ issues: containing(expect.objectContaining({ message: invalid() })) })
  })

  it("a ref naming no definition, an invalid pattern, a refused key that is also in the shape, a discriminatedUnion member without a literal key, and requireOneOf naming a missing key are each refused at their option's path (rejects a meta-schema that checks only shape)", () => {
    const danglingRef = refusalOf({ type: 'object', shape: { a: { type: 'ref', name: 'Missing' } }, definitions: {} })
    const badPattern = refusalOf({ type: 'object', shape: { a: { type: 'string', pattern: '(' } } })
    const refusedAndShaped = refusalOf({ type: 'object', shape: { a: { type: 'string' } }, refusedKeys: { a: 'a is not allowed' } })
    const unkeyedMember = refusalOf({
      type: 'discriminatedUnion',
      discriminator: 'kind',
      members: [
        { type: 'object', shape: { kind: { type: 'literal', value: 'one' } } },
        { type: 'object', shape: { kind: { type: 'string' } } },
      ],
    })
    const missingRequired = refusalOf({ type: 'object', shape: { a: { type: 'string', optional: true } }, requireOneOf: ['b'] })

    expect(danglingRef).toBeInstanceOf(SchemaError)
    expect(danglingRef).toMatchObject({ issues: containing({ path: ['shape', 'a', 'name'], message: invalid() }) })
    expect(badPattern).toMatchObject({ issues: containing({ path: ['shape', 'a', 'pattern'], message: invalid() }) })
    expect(refusedAndShaped).toMatchObject({ issues: containing({ path: ['refusedKeys', 'a'], message: invalid() }) })
    expect(unkeyedMember).toMatchObject({ issues: containing({ path: ['members', 1, 'shape', 'kind'], message: invalid() }) })
    expect(missingRequired).toMatchObject({ issues: containing({ path: ['requireOneOf', 0], message: invalid() }) })
  })
})
