import { describe, expect, it } from 'vitest'

import { isParseOutcome } from '../src/index'

describe('isParseOutcome', () => {
  it('accepts a known parse outcome', () => {
    expect(isParseOutcome('parsed')).toBe(true)
    expect(isParseOutcome('refused')).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isParseOutcome('unknown')).toBe(false)
    expect(isParseOutcome(1)).toBe(false)
  })
})
