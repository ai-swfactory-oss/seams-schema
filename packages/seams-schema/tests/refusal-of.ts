import { expect } from 'vitest'

import { type Definition, schema } from '../src/index'

const isDefinitionShaped = (value: unknown): value is Definition => typeof value === 'object'

const untyped = (value: unknown): Definition => {
  if (isDefinitionShaped(value)) return value
  throw new TypeError('a definition fixture must be an object')
}

export const thrownBy = (run: () => unknown): unknown => {
  try {
    run()
  } catch (error) {
    return error
  }
  return undefined
}

export const refusalOf = (definition: unknown): unknown => thrownBy(() => schema(untyped(definition)))

export const invalid = (): unknown => expect.stringMatching(/^invalid definition: /)

export const containing = (...items: unknown[]): unknown => expect.arrayContaining(items)
