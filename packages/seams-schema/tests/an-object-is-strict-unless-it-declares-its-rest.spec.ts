import { describe, expect, it } from 'vitest'

import { schema } from '../src/index'

describe('an object is strict unless it declares its rest', () => {
  it('an object without rest refuses an unlisted key at that key (rejects a builder that strips by default)', () => {
    const strict = schema({ type: 'object', shape: { a: { type: 'string' } } })

    expect(strict.safeParse({ a: 'x', b: 1 })).toMatchObject({ success: false, issues: [{ path: ['b'] }] })
  })

  it("an object with rest 'strip' accepts an unlisted key and drops it (rejects a builder that keeps unlisted keys or refuses them)", () => {
    const stripping = schema({ type: 'object', shape: { a: { type: 'string' } }, rest: 'strip' })

    expect(stripping.safeParse({ a: 'x', b: 1 })).toStrictEqual({ success: true, data: { a: 'x' } })
  })

  it('an object with a rest definition admits an unlisted key whose value meets it and refuses one that does not (rejects a rest that is ignored)', () => {
    const counted = schema({ type: 'object', shape: { a: { type: 'string' } }, rest: { type: 'number' } })

    expect(counted.safeParse({ a: 'x', b: 1 })).toStrictEqual({ success: true, data: { a: 'x', b: 1 } })
    expect(counted.safeParse({ a: 'x', b: 'one' })).toMatchObject({ success: false, issues: [{ path: ['b'] }] })
  })
})
