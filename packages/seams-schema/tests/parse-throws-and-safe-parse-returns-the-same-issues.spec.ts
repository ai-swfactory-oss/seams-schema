import { describe, expect, it } from 'vitest'

import { schema, SchemaError } from '../src/index'

const thrownBy = (run: () => unknown): unknown => {
  try {
    run()
  } catch (error) {
    return error
  }
  return undefined
}

describe('parse throws and safeParse returns the same issues', () => {
  it('parse throws SchemaError carrying exactly the issues safeParse returns for the same input (rejects issues that differ between the two)', () => {
    const subject = schema({ type: 'object', shape: { name: { type: 'string', minLength: 1 }, count: { type: 'integer', min: 0 } } })
    const input = { name: '', count: -1 }
    const thrown = thrownBy(() => subject.parse(input))
    const returned = subject.safeParse(input)

    expect(thrown).toBeInstanceOf(SchemaError)
    expect(returned).toMatchObject({ success: false, issues: [{ path: ['name'] }, { path: ['count'] }] })
    expect(thrown).toMatchObject({ issues: returned.success ? [] : returned.issues })
  })
})
