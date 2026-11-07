import { describe, expect, it } from 'vitest'

import { schema } from '../src/index'

describe('a constraint refuses with its declared message', () => {
  it('pattern given message refuses with exactly that message, and without it refuses with the default (rejects a message that never reaches the refusal)', () => {
    const declared = schema({ type: 'string', pattern: '^[a-z]+$', message: 'use lower-case letters' })
    const defaulted = schema({ type: 'string', pattern: '^[a-z]+$' })

    expect(declared.safeParse('ABC')).toStrictEqual({ success: false, issues: [{ path: [], message: 'use lower-case letters' }] })
    expect(defaulted.safeParse('ABC')).toStrictEqual({ success: false, issues: [{ path: [], message: 'must match the pattern ^[a-z]+$' }] })
  })

  it('minLength on a string given message refuses with exactly that message, and without it refuses with the default (rejects a message that never reaches the refusal)', () => {
    const declared = schema({ type: 'string', minLength: 2, message: 'name the target' })
    const defaulted = schema({ type: 'string', minLength: 2 })

    expect(declared.safeParse('a')).toStrictEqual({ success: false, issues: [{ path: [], message: 'name the target' }] })
    expect(defaulted.safeParse('a')).toStrictEqual({ success: false, issues: [{ path: [], message: 'must be at least 2 characters' }] })
  })

  it('minLength on an array given message refuses with exactly that message, and without it refuses with the default (rejects a message that never reaches the refusal)', () => {
    const declared = schema({ type: 'array', items: { type: 'string' }, minLength: 2, message: 'list two targets' })
    const defaulted = schema({ type: 'array', items: { type: 'string' }, minLength: 2 })

    expect(declared.safeParse(['a'])).toStrictEqual({ success: false, issues: [{ path: [], message: 'list two targets' }] })
    expect(defaulted.safeParse(['a'])).toStrictEqual({ success: false, issues: [{ path: [], message: 'must have at least 2 items' }] })
  })

  it('min given message refuses with exactly that message, and without it refuses with the default (rejects a message that never reaches the refusal)', () => {
    const declared = schema({ type: 'number', min: 1, message: 'retry at least once' })
    const defaulted = schema({ type: 'number', min: 1 })

    expect(declared.safeParse(0)).toStrictEqual({ success: false, issues: [{ path: [], message: 'retry at least once' }] })
    expect(defaulted.safeParse(0)).toStrictEqual({ success: false, issues: [{ path: [], message: 'must be at least 1' }] })
  })

  it('max given message refuses with exactly that message, and without it refuses with the default (rejects a message that never reaches the refusal)', () => {
    const declared = schema({ type: 'integer', max: 9, message: 'retry at most nine times' })
    const defaulted = schema({ type: 'integer', max: 9 })

    expect(declared.safeParse(10)).toStrictEqual({ success: false, issues: [{ path: [], message: 'retry at most nine times' }] })
    expect(defaulted.safeParse(10)).toStrictEqual({ success: false, issues: [{ path: [], message: 'must be at most 9' }] })
  })

  it('unique given message refuses with exactly that message, and without it refuses with the default (rejects a message that never reaches the refusal)', () => {
    const declared = schema({ type: 'array', items: { type: 'string' }, unique: true, message: 'name each target once' })
    const defaulted = schema({ type: 'array', items: { type: 'string' }, unique: true })

    expect(declared.safeParse(['a', 'a'])).toStrictEqual({ success: false, issues: [{ path: [1], message: 'name each target once' }] })
    expect(defaulted.safeParse(['a', 'a'])).toStrictEqual({ success: false, issues: [{ path: [1], message: 'must not repeat an item' }] })
  })

  it('requireOneOf given message refuses with exactly that message, and without it refuses with the default (rejects a message that never reaches the refusal)', () => {
    const declared = schema({
      type: 'object',
      shape: { a: { type: 'string', optional: true }, b: { type: 'string', optional: true } },
      requireOneOf: ['a', 'b'],
      message: 'give a or b',
    })
    const defaulted = schema({
      type: 'object',
      shape: { a: { type: 'string', optional: true }, b: { type: 'string', optional: true } },
      requireOneOf: ['a', 'b'],
    })

    expect(declared.safeParse({})).toStrictEqual({ success: false, issues: [{ path: ['a'], message: 'give a or b' }] })
    expect(defaulted.safeParse({})).toStrictEqual({ success: false, issues: [{ path: ['a'], message: 'must have one of: a, b' }] })
  })
})
