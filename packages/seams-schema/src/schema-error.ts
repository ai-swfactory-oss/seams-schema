import type { z } from 'zod'

export interface Issue {
  readonly path: readonly (string | number)[]
  readonly message: string
}

export class SchemaError extends Error {
  readonly issues: readonly Issue[]

  constructor(issues: readonly Issue[]) {
    super(issues.map(issue => issue.message).join('\n'))
    this.name = 'SchemaError'
    this.issues = issues
  }
}

type IssuePath = Issue['path']

const isPlainKey = (key: PropertyKey): key is string | number => typeof key !== 'symbol'

const plainPath = (path: readonly PropertyKey[]): (string | number)[] => path.filter(isPlainKey)

const messageOf = (issue: z.core.$ZodIssue): string => {
  if (issue.code === 'invalid_key') return issue.issues[0]?.message ?? issue.message
  return issue.message
}

const unrecognized = (path: IssuePath, key: string): Issue => {
  return { path: [...path, key], message: `Unrecognized key: ${JSON.stringify(key)}` }
}

export const parseIssues = (issues: readonly z.core.$ZodIssue[]): Issue[] => {
  return issues.flatMap(issue => {
    const path = plainPath(issue.path)
    if (issue.code === 'unrecognized_keys') return issue.keys.map(key => unrecognized(path, key))
    return [{ path, message: messageOf(issue) }]
  })
}

export const definitionIssues = (issues: readonly z.core.$ZodIssue[], base: IssuePath): Issue[] => {
  return issues.map(issue => ({ path: [...base, ...plainPath(issue.path)], message: `invalid definition: ${messageOf(issue)}` }))
}
