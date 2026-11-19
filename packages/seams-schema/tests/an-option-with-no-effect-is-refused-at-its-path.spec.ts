import { describe, expect, it } from 'vitest'

import { schema, SchemaError } from '../src/index'
import { containing, invalid, refusalOf } from './refusal-of'

const unionWithNullAsOnMember = {
  type: 'discriminatedUnion',
  discriminator: 'kind',
  members: [
    { type: 'object', shape: { kind: { type: 'literal', value: 'a' } } },
    { type: 'object', shape: { kind: { type: 'literal', value: 'b' } }, nullAs: { kind: 'b' } },
  ],
}

const recordWithCoercedKeys = { type: 'record', keys: { type: 'string', coerceFrom: ['number'] }, values: { type: 'string' } }

describe('an option with no effect is refused at its path', () => {
  it("nullAs on a discriminatedUnion member throws SchemaError at that member's nullAs (rejects a meta-schema that accepts an option it never applies)", () => {
    const refusal = refusalOf(unionWithNullAsOnMember)

    expect(refusal).toBeInstanceOf(SchemaError)
    expect(refusal).toMatchObject({
      issues: [{ path: ['members', 1, 'nullAs'], message: 'invalid definition: nullAs has no effect on a discriminatedUnion member' }],
    })
  })

  it("coerceFrom on a record's keys throws SchemaError at keys.coerceFrom (rejects a meta-schema that accepts an option it never applies)", () => {
    const refusal = refusalOf(recordWithCoercedKeys)

    expect(refusal).toBeInstanceOf(SchemaError)
    expect(refusal).toMatchObject({
      issues: [{ path: ['keys', 'coerceFrom'], message: "invalid definition: coerceFrom has no effect on a record's keys" }],
    })
  })

  it('each refusal holds one level down and through definitions (rejects a check that reads only the root node)', () => {
    const oneLevelDown = refusalOf({ type: 'object', shape: { a: recordWithCoercedKeys } })
    const throughDefinitions = refusalOf({ type: 'ref', name: 'u', definitions: { u: unionWithNullAsOnMember } })

    expect(oneLevelDown).toBeInstanceOf(SchemaError)
    expect(oneLevelDown).toMatchObject({ issues: containing({ path: ['shape', 'a', 'keys', 'coerceFrom'], message: invalid() }) })
    expect(throughDefinitions).toBeInstanceOf(SchemaError)
    expect(throughDefinitions).toMatchObject({
      issues: containing({ path: ['definitions', 'u', 'members', 1, 'nullAs'], message: invalid() }),
    })
  })

  it('nullAs on an object that is not a discriminatedUnion member is accepted and applied (rejects a check that refuses nullAs everywhere)', () => {
    expect(schema({ type: 'object', shape: { a: { type: 'string', optional: true } }, nullAs: {} }).parse(null)).toEqual({})
  })

  it("coerceFrom on a string that is not a record's keys is accepted and applied (rejects a check that refuses coerceFrom everywhere)", () => {
    expect(schema({ type: 'string', coerceFrom: ['number'] }).parse(1)).toBe('1')
  })
})
