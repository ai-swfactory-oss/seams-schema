import { describe, expect, it } from 'vitest'

import { schema } from '../src/index'

describe('each option parses as its zod construct', () => {
  it('optional lets the key be absent and drops an explicit undefined (rejects an optional that keeps undefined or requires the key)', () => {
    const subject = schema({ type: 'object', shape: { a: { type: 'string' }, b: { type: 'string', optional: true } } })

    expect(subject.safeParse({ a: 'x', b: undefined })).toStrictEqual({ success: true, data: { a: 'x' } })
    expect(subject.safeParse({ a: 'x', b: 1 })).toMatchObject({ success: false, issues: [{ path: ['b'] }] })
  })

  it('default parses an absent key to a fresh copy of the default (rejects a default shared between parses)', () => {
    const subject = schema({ type: 'object', shape: { tags: { type: 'array', items: { type: 'string' }, default: [] } } })
    const first = subject.parse({})
    const second = subject.parse({})

    expect(first).toStrictEqual({ tags: [] })
    expect(first.tags).not.toBe(second.tags)
    expect(subject.safeParse({ tags: 1 })).toMatchObject({ success: false, issues: [{ path: ['tags'] }] })
  })

  it('minLength refuses a string shorter than the bound (rejects a minLength that is ignored)', () => {
    const subject = schema({ type: 'object', shape: { s: { type: 'string', minLength: 2 } } })

    expect(subject.safeParse({ s: 'ab' })).toStrictEqual({ success: true, data: { s: 'ab' } })
    expect(subject.safeParse({ s: 'a' })).toMatchObject({ success: false, issues: [{ path: ['s'] }] })
  })

  it('min refuses a number below the bound (rejects a min that is ignored)', () => {
    const subject = schema({ type: 'object', shape: { n: { type: 'number', min: 1 } } })

    expect(subject.safeParse({ n: 1 })).toStrictEqual({ success: true, data: { n: 1 } })
    expect(subject.safeParse({ n: 0 })).toMatchObject({ success: false, issues: [{ path: ['n'] }] })
  })

  it('max refuses a number above the bound (rejects a max that is ignored)', () => {
    const subject = schema({ type: 'object', shape: { n: { type: 'integer', max: 9 } } })

    expect(subject.safeParse({ n: 9 })).toStrictEqual({ success: true, data: { n: 9 } })
    expect(subject.safeParse({ n: 10 })).toMatchObject({ success: false, issues: [{ path: ['n'] }] })
  })

  it('pattern refuses a string that does not match (rejects a pattern that is ignored)', () => {
    const subject = schema({ type: 'object', shape: { s: { type: 'string', pattern: '^[a-z]+$' } } })

    expect(subject.safeParse({ s: 'abc' })).toStrictEqual({ success: true, data: { s: 'abc' } })
    expect(subject.safeParse({ s: 'ABC' })).toMatchObject({ success: false, issues: [{ path: ['s'] }] })
  })

  it('trim parses to the trimmed string (rejects a trim that keeps the whitespace)', () => {
    const subject = schema({ type: 'object', shape: { s: { type: 'string', trim: true } } })

    expect(subject.safeParse({ s: '  x ' })).toStrictEqual({ success: true, data: { s: 'x' } })
    expect(subject.safeParse({ s: 1 })).toMatchObject({ success: false, issues: [{ path: ['s'] }] })
  })

  it("coerceFrom ['number'] on a string parses a finite number to its string (rejects a string that refuses a number)", () => {
    const subject = schema({ type: 'object', shape: { s: { type: 'string', coerceFrom: ['number'] } } })

    expect(subject.safeParse({ s: 3 })).toStrictEqual({ success: true, data: { s: '3' } })
    expect(subject.safeParse({ s: true })).toMatchObject({ success: false, issues: [{ path: ['s'] }] })
  })

  it("coerceFrom ['string'] on an integer parses a non-blank numeric string to its number (rejects a coercion of a blank string to 0)", () => {
    const subject = schema({ type: 'object', shape: { n: { type: 'integer', coerceFrom: ['string'] } } })

    expect(subject.safeParse({ n: '42' })).toStrictEqual({ success: true, data: { n: 42 } })
    expect(subject.safeParse({ n: ' ' })).toMatchObject({ success: false, issues: [{ path: ['n'] }] })
  })

  it('acceptSingle parses a single value as a one-item array (rejects an array that refuses a single value)', () => {
    const subject = schema({ type: 'object', shape: { xs: { type: 'array', items: { type: 'string' }, acceptSingle: true } } })

    expect(subject.safeParse({ xs: 'a' })).toStrictEqual({ success: true, data: { xs: ['a'] } })
    expect(subject.safeParse({ xs: 1 })).toMatchObject({ success: false, issues: [{ path: ['xs'] }] })
  })

  it("unique true refuses two equal items and unique '<field>' refuses two items equal at that field (rejects a unique that is ignored)", () => {
    const subject = schema({
      type: 'object',
      shape: {
        names: { type: 'array', items: { type: 'string' }, unique: true },
        entries: { type: 'array', items: { type: 'object', shape: { id: { type: 'string' }, n: { type: 'number' } } }, unique: 'id' },
      },
    })
    const distinct = [
      { id: 'a', n: 1 },
      { id: 'b', n: 1 },
    ]
    const sameId = [
      { id: 'a', n: 1 },
      { id: 'a', n: 2 },
    ]

    expect(subject.safeParse({ names: ['a', 'b'], entries: distinct })).toStrictEqual({
      success: true,
      data: { names: ['a', 'b'], entries: distinct },
    })
    expect(subject.safeParse({ names: ['a', 'a'], entries: sameId })).toMatchObject({
      success: false,
      issues: [{ path: ['names', 1] }, { path: ['entries', 1, 'id'] }],
    })
  })

  it('requireOneOf refuses an object with none of the keys at the first key (rejects a requireOneOf that is ignored)', () => {
    const subject = schema({
      type: 'object',
      shape: { a: { type: 'string', optional: true }, b: { type: 'string', optional: true } },
      requireOneOf: ['a', 'b'],
    })

    expect(subject.safeParse({ b: 'x' })).toStrictEqual({ success: true, data: { b: 'x' } })
    expect(subject.safeParse({})).toMatchObject({ success: false, issues: [{ path: ['a'] }] })
  })

  it('nullAs parses null as the given value (rejects a nullAs that refuses null)', () => {
    const subject = schema({
      type: 'object',
      shape: { opts: { type: 'object', shape: { a: { type: 'string', optional: true } }, nullAs: {} } },
    })

    expect(subject.safeParse({ opts: null })).toStrictEqual({ success: true, data: { opts: {} } })
    expect(subject.safeParse({ opts: 1 })).toMatchObject({ success: false, issues: [{ path: ['opts'] }] })
  })

  it('refusedKeys refuses each named key that is present with its own message, on an object and on a record (rejects a refusedKeys that is ignored)', () => {
    const subject = schema({
      type: 'object',
      shape: {
        object: { type: 'object', shape: { a: { type: 'string' } }, rest: 'strip', refusedKeys: { b: 'b is retired' } },
        record: { type: 'record', values: { type: 'string' }, refusedKeys: { c: 'c is retired' } },
      },
    })

    expect(subject.safeParse({ object: { a: 'x' }, record: { d: 'y' } })).toStrictEqual({
      success: true,
      data: { object: { a: 'x' }, record: { d: 'y' } },
    })
    expect(subject.safeParse({ object: { a: 'x', b: 1 }, record: { c: 'y' } })).toMatchObject({
      success: false,
      issues: [
        { path: ['object', 'b'], message: 'b is retired' },
        { path: ['record', 'c'], message: 'c is retired' },
      ],
    })
  })

  it('a record keys pattern refuses a key that fails it (rejects record keys that are ignored)', () => {
    const subject = schema({
      type: 'object',
      shape: { r: { type: 'record', values: { type: 'number' }, keys: { type: 'string', pattern: '^[a-z]+$' } } },
    })

    expect(subject.safeParse({ r: { ab: 1 } })).toStrictEqual({ success: true, data: { r: { ab: 1 } } })
    expect(subject.safeParse({ r: { AB: 1 } })).toMatchObject({ success: false, issues: [{ path: ['r', 'AB'] }] })
  })

  it('literal refuses any other value (rejects a literal that accepts its base type)', () => {
    const subject = schema({ type: 'object', shape: { v: { type: 'literal', value: 'on' } } })

    expect(subject.safeParse({ v: 'on' })).toStrictEqual({ success: true, data: { v: 'on' } })
    expect(subject.safeParse({ v: 'off' })).toMatchObject({ success: false, issues: [{ path: ['v'] }] })
  })

  it('enum refuses a value outside its values (rejects an enum that accepts any string)', () => {
    const subject = schema({ type: 'object', shape: { v: { type: 'enum', values: ['red', 'green'] } } })

    expect(subject.safeParse({ v: 'green' })).toStrictEqual({ success: true, data: { v: 'green' } })
    expect(subject.safeParse({ v: 'blue' })).toMatchObject({ success: false, issues: [{ path: ['v'] }] })
  })

  it('union refuses a value no member matches (rejects a union that accepts any value)', () => {
    const subject = schema({ type: 'object', shape: { v: { type: 'union', members: [{ type: 'string' }, { type: 'number' }] } } })

    expect(subject.safeParse({ v: 1 })).toStrictEqual({ success: true, data: { v: 1 } })
    expect(subject.safeParse({ v: true })).toMatchObject({ success: false, issues: [{ path: ['v'] }] })
  })

  it('discriminatedUnion refuses a value whose discriminator matches no member (rejects a discriminatedUnion that accepts any object)', () => {
    const subject = schema({
      type: 'discriminatedUnion',
      discriminator: 'kind',
      members: [
        { type: 'object', shape: { kind: { type: 'literal', value: 'a' }, a: { type: 'string' } } },
        { type: 'object', shape: { kind: { type: 'literal', value: 'b' }, b: { type: 'number' } } },
      ],
    })

    expect(subject.safeParse({ kind: 'b', b: 1 })).toStrictEqual({ success: true, data: { kind: 'b', b: 1 } })
    expect(subject.safeParse({ kind: 'c' })).toMatchObject({ success: false, issues: [{ path: ['kind'] }] })
  })

  it('a recursive ref parses a nested value three levels deep (rejects a ref that resolves only one level)', () => {
    const subject = schema({
      type: 'ref',
      name: 'Tree',
      definitions: {
        Tree: {
          type: 'object',
          shape: { name: { type: 'string' }, children: { type: 'array', items: { type: 'ref', name: 'Tree' }, optional: true } },
        },
      },
    })
    const tree = { name: 'a', children: [{ name: 'b', children: [{ name: 'c' }] }] }

    expect(subject.safeParse(tree)).toStrictEqual({ success: true, data: tree })
    expect(subject.safeParse({ name: 'a', children: [{ name: 'b', children: [{ name: 1 }] }] })).toMatchObject({
      success: false,
      issues: [{ path: ['children', 0, 'children', 0, 'name'] }],
    })
  })
})
