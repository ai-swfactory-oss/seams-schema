import { build } from './build'
import { checkDefinition } from './check-definition'
import type { Checked, Definition } from './definition'
import type { OutputOf } from './output'
import { copyOf } from './plain-data'
import { type Issue, parseIssues, SchemaError } from './schema-error'

export type SafeParseResult<T> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly issues: readonly Issue[] }

export interface Schema<T> {
  readonly definition: Definition
  readonly parse: (input: unknown) => T
  readonly safeParse: (input: unknown) => SafeParseResult<T>
}

export const schema = <const D extends Definition>(definition: D & Checked<D>): Schema<OutputOf<D>> => {
  const assertDefinition: (value: unknown) => asserts value is D = () => undefined
  const assertOutput: (value: unknown) => asserts value is OutputOf<D> = () => undefined
  const frozen = copyOf(definition, true)
  assertDefinition(frozen)
  const parser = build(frozen, checkDefinition(frozen))
  const safeParse = (input: unknown): SafeParseResult<OutputOf<D>> => {
    const result = parser.safeParse(input)
    if (!result.success) return { success: false, issues: parseIssues(result.error.issues) }
    const data: unknown = result.data
    assertOutput(data)
    return { success: true, data }
  }
  const parse = (input: unknown): OutputOf<D> => {
    const result = safeParse(input)
    if (result.success) return result.data
    throw new SchemaError(result.issues)
  }
  return Object.freeze({ definition: frozen, parse, safeParse })
}
