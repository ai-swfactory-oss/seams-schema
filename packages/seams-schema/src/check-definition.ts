import { z } from 'zod'

import type { Definition, DiscriminatedUnionNode, ObjectNode, RecordNode } from './definition'
import { isRecord } from './plain-data'
import { definitionIssues, type Issue, SchemaError } from './schema-error'

export type Definitions = Readonly<Record<string, Definition>>

type Path = Issue['path']

const child: z.ZodType = z.lazy((): z.ZodType => definitionNode)

const options = { optional: z.boolean().optional(), default: z.unknown().optional() }

const message = z.string().optional()

const count = z.number().int().gte(0).optional()

const keyMessages = z.record(z.string(), z.string()).optional()

const stringNode = z.strictObject({
  type: z.literal('string'),
  ...options,
  minLength: count,
  pattern: z.string().optional(),
  trim: z.boolean().optional(),
  coerceFrom: z.tuple([z.literal('number')]).optional(),
  brand: z.string().optional(),
  message,
})

const numberOptions = {
  ...options,
  min: z.number().optional(),
  max: z.number().optional(),
  coerceFrom: z.tuple([z.literal('string')]).optional(),
  brand: z.string().optional(),
  message,
}

const objectNode = z.strictObject({
  type: z.literal('object'),
  ...options,
  shape: z.record(z.string(), child),
  rest: z.union([z.literal('strip'), child]).optional(),
  nullAs: z.unknown().optional(),
  refusedKeys: keyMessages,
  requireOneOf: z.tuple([z.string()], z.string()).optional(),
  message,
})

const definitionNode: z.ZodType = z.discriminatedUnion('type', [
  stringNode,
  z.strictObject({ type: z.literal('number'), ...numberOptions }),
  z.strictObject({ type: z.literal('integer'), ...numberOptions }),
  z.strictObject({ type: z.literal('boolean'), ...options }),
  z.strictObject({ type: z.literal('null'), ...options }),
  z.strictObject({ type: z.literal('literal'), ...options, value: z.union([z.string(), z.number(), z.boolean(), z.null()]) }),
  z.strictObject({ type: z.literal('enum'), ...options, values: z.tuple([z.string()], z.string()) }),
  z.strictObject({
    type: z.literal('array'),
    ...options,
    items: child,
    minLength: count,
    acceptSingle: z.boolean().optional(),
    unique: z.union([z.literal(true), z.string()]).optional(),
    message,
  }),
  z.strictObject({ type: z.literal('record'), ...options, values: child, keys: stringNode.optional(), refusedKeys: keyMessages }),
  objectNode,
  z.strictObject({ type: z.literal('union'), ...options, members: z.array(child) }),
  z.strictObject({ type: z.literal('discriminatedUnion'), ...options, discriminator: z.string(), members: z.array(objectNode) }),
  z.strictObject({ type: z.literal('unknown'), ...options, because: z.string().regex(/\S/) }),
  z.strictObject({ type: z.literal('ref'), ...options, name: z.string() }),
])

const definitionMap = z.record(z.string(), definitionNode).optional()

const isDefinition = (value: unknown): value is Definition => definitionNode.safeParse(value).success

const isDefinitions = (value: unknown): value is Definitions => definitionMap.safeParse(value).success && value !== undefined

const rootOf = (definition: unknown): unknown => {
  if (!isRecord(definition)) return definition
  return Object.fromEntries(Object.entries(definition).filter(([key]) => key !== 'definitions'))
}

const definitionsFieldOf = (definition: unknown): unknown => (isRecord(definition) ? definition.definitions : undefined)

const failures = (result: z.ZodSafeParseResult<unknown>, path: Path): Issue[] => definitionIssues(result.error?.issues ?? [], path)

const invalid = (path: Path, reason: string): Issue => ({ path, message: `invalid definition: ${reason}` })

const patternIssues = (pattern: string | undefined, path: Path): Issue[] => {
  if (pattern === undefined) return []
  try {
    new RegExp(pattern)
    return []
  } catch {
    return [invalid([...path, 'pattern'], `pattern ${pattern} is not a regular expression`)]
  }
}

const objectIssues = (node: ObjectNode, path: Path, definitions: Definitions): Issue[] => {
  const declared = (key: string): boolean => Object.hasOwn(node.shape, key)
  const oneOf: readonly string[] = node.requireOneOf ?? []
  const shape = Object.entries(node.shape).flatMap(([key, entry]) => walk(entry, [...path, 'shape', key], definitions))
  const rest = node.rest === undefined || node.rest === 'strip' ? [] : walk(node.rest, [...path, 'rest'], definitions)
  const refused = Object.keys(node.refusedKeys ?? {})
    .filter(declared)
    .map(key => invalid([...path, 'refusedKeys', key], `refused key ${key} is also in the shape`))
  const missing = oneOf.flatMap((key, index) => {
    if (declared(key)) return []
    return [invalid([...path, 'requireOneOf', index], `requireOneOf names ${key}, which the shape does not declare`)]
  })
  return [...shape, ...rest, ...refused, ...missing]
}

const recordIssues = (node: RecordNode, path: Path, definitions: Definitions): Issue[] => {
  const keys = node.keys === undefined ? [] : walk(node.keys, [...path, 'keys'], definitions)
  return [...walk(node.values, [...path, 'values'], definitions), ...keys]
}

const discriminatedUnionIssues = (node: DiscriminatedUnionNode, path: Path, definitions: Definitions): Issue[] => {
  return node.members.flatMap((member, index) => {
    const memberPath = [...path, 'members', index]
    const keyed = member.shape[node.discriminator]?.type === 'literal'
    const keyPath = [...memberPath, 'shape', node.discriminator]
    const unkeyed = keyed ? [] : [invalid(keyPath, `member ${String(index)} has no literal ${node.discriminator}`)]
    return [...walk(member, memberPath, definitions), ...unkeyed]
  })
}

const walk = (node: Definition, path: Path, definitions: Definitions): Issue[] => {
  switch (node.type) {
    case 'string':
      return patternIssues(node.pattern, path)
    case 'array':
      return walk(node.items, [...path, 'items'], definitions)
    case 'record':
      return recordIssues(node, path, definitions)
    case 'object':
      return objectIssues(node, path, definitions)
    case 'union':
      return node.members.flatMap((member, index) => walk(member, [...path, 'members', index], definitions))
    case 'discriminatedUnion':
      return discriminatedUnionIssues(node, path, definitions)
    case 'ref':
      return Object.hasOwn(definitions, node.name) ? [] : [invalid([...path, 'name'], `ref ${node.name} names no definition`)]
    default:
      return []
  }
}

const objectAcceptsAny = (node: ObjectNode, definitions: Definitions, seen: readonly string[]): boolean => {
  if (Object.keys(node.shape).length > 0 || node.rest === undefined || node.rest === 'strip') return false
  return acceptsAny(node.rest, definitions, seen)
}

const refAcceptsAny = (name: string, definitions: Definitions, seen: readonly string[]): boolean => {
  const target = Object.hasOwn(definitions, name) ? definitions[name] : undefined
  if (target === undefined || seen.includes(name)) return false
  return acceptsAny(target, definitions, [...seen, name])
}

const acceptsAny = (node: Definition, definitions: Definitions, seen: readonly string[]): boolean => {
  switch (node.type) {
    case 'unknown':
      return true
    case 'record':
      return acceptsAny(node.values, definitions, seen)
    case 'array':
      return acceptsAny(node.items, definitions, seen)
    case 'object':
      return objectAcceptsAny(node, definitions, seen)
    case 'union':
      return node.members.some(member => acceptsAny(member, definitions, seen))
    case 'ref':
      return refAcceptsAny(node.name, definitions, seen)
    default:
      return false
  }
}

const meaningIssues = (root: Definition, definitions: Definitions): Issue[] => {
  const named = Object.entries(definitions).flatMap(([name, entry]) => walk(entry, ['definitions', name], definitions))
  const whole = acceptsAny(root, definitions, []) ? [invalid([], 'a whole parameter schema cannot be unknown: declare its keys')] : []
  return [...walk(root, [], definitions), ...named, ...whole]
}

export const checkDefinition = (definition: unknown): Definitions => {
  const root = rootOf(definition)
  const field = definitionsFieldOf(definition)
  const structural = [...failures(definitionNode.safeParse(root), []), ...failures(definitionMap.safeParse(field), ['definitions'])]
  if (structural.length > 0) throw new SchemaError(structural)
  const definitions = isDefinitions(field) ? field : {}
  const meaning = isDefinition(root) ? meaningIssues(root, definitions) : []
  if (meaning.length > 0) throw new SchemaError(meaning)
  return definitions
}
