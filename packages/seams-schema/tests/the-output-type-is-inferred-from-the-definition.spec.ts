import { describe, expectTypeOf, it } from 'vitest'

import { schema } from '../src/index'
import type { SpecBrandValue } from './spec-brand'

describe('the output type is inferred from the definition', () => {
  it("parse's output type is inferred from the literal, with default keys required and optional keys optional (rejects a Schema<unknown>)", () => {
    const subject = schema({
      type: 'object',
      shape: {
        name: { type: 'string' },
        retries: { type: 'integer', default: 0 },
        note: { type: 'string', optional: true },
        mode: { type: 'enum', values: ['fast', 'safe'] },
        tags: { type: 'array', items: { type: 'string' } },
      },
    })

    expectTypeOf<ReturnType<typeof subject.parse>>().toEqualTypeOf<{
      name: string
      retries: number
      note?: string
      mode: 'fast' | 'safe'
      tags: string[]
    }>()
  })

  it('a brand in the BrandRegistry infers that type, and a brand not in the registry is a nominal brand a plain string or number does not satisfy (rejects a brand that widens to string or number)', () => {
    const registered = schema({ type: 'string', brand: 'SpecBrand' })
    const plainBrand = schema({ type: 'string', brand: 'NotInRegistry' })
    const plainNumberBrand = schema({ type: 'number', brand: 'NotInRegistry' })

    expectTypeOf<ReturnType<typeof registered.parse>>().toEqualTypeOf<SpecBrandValue>()
    expectTypeOf<string>().not.toExtend<ReturnType<typeof plainBrand.parse>>()
    expectTypeOf<number>().not.toExtend<ReturnType<typeof plainNumberBrand.parse>>()
  })
})
