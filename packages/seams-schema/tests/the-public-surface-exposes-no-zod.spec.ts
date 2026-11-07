import { describe, expect, expectTypeOf, it } from 'vitest'

import * as entry from '../src/index'

describe('the public surface exposes no zod', () => {
  it("Schema's members are exactly the plain definition, parse and safeParse types (rejects a Schema that exposes a ZodType)", () => {
    expectTypeOf<keyof entry.Schema<string>>().toEqualTypeOf<'definition' | 'parse' | 'safeParse'>()
    expectTypeOf<entry.Schema<string>['definition']>().toEqualTypeOf<entry.Definition>()
    expectTypeOf<entry.Schema<string>['parse']>().toEqualTypeOf<(input: unknown) => string>()
    expectTypeOf<entry.Schema<string>['safeParse']>().toEqualTypeOf<(input: unknown) => entry.SafeParseResult<string>>()
    expectTypeOf<entry.SafeParseResult<string>>().toEqualTypeOf<
      { readonly success: true; readonly data: string } | { readonly success: false; readonly issues: readonly entry.Issue[] }
    >()
  })

  it("SchemaError's issues are plain { path, message } values (rejects a SchemaError that carries a ZodError)", () => {
    expectTypeOf<entry.SchemaError['issues']>().toEqualTypeOf<readonly entry.Issue[]>()
    expectTypeOf<entry.Issue>().toEqualTypeOf<{ readonly path: readonly (string | number)[]; readonly message: string }>()
    expectTypeOf<Exclude<keyof entry.SchemaError, keyof Error>>().toEqualTypeOf<'issues'>()
    expectTypeOf<entry.SchemaError['cause']>().toEqualTypeOf<unknown>()
  })

  it('Definition is the union of the plain node types and nothing else (rejects a Definition that admits a zod schema as a node)', () => {
    expectTypeOf<entry.Definition>().toEqualTypeOf<
      | entry.StringNode
      | entry.NumberNode
      | entry.IntegerNode
      | entry.BooleanNode
      | entry.NullNode
      | entry.LiteralNode
      | entry.EnumNode
      | entry.ArrayNode
      | entry.RecordNode
      | entry.ObjectNode
      | entry.UnionNode
      | entry.DiscriminatedUnionNode
      | entry.UnknownNode
      | entry.RefNode
    >()
  })

  it('BrandRegistry ships only its reserved member, so its keys are that member and the one the spec project adds (rejects a BrandRegistry that ships members, such as a zod type)', () => {
    expectTypeOf<keyof entry.BrandRegistry>().toEqualTypeOf<'unregistered' | 'SpecBrand'>()
  })

  it("the package entry's exported names are exactly schema and SchemaError (rejects a new export that slips past the type pins)", () => {
    expect(Object.keys(entry).sort()).toStrictEqual(['SchemaError', 'schema'])
  })
})
