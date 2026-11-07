import { z } from 'zod'

import type { Definitions } from './check-definition'
import type {
  ArrayNode,
  Definition,
  DiscriminatedUnionNode,
  IntegerNode,
  NumberNode,
  ObjectNode,
  RecordNode,
  StringNode,
} from './definition'
import { copyOf, isRecord } from './plain-data'

type ObjectSchema = z.ZodObject<Record<string, z.ZodType>, z.core.$ZodObjectConfig>

type ItemPath = (string | number)[]

const finiteNumberAsString = (value: unknown): unknown => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return value
}

const numericStringAsNumber = (value: unknown): unknown => {
  if (typeof value !== 'string' || value.trim() === '') return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : value
}

const stringChecks = (node: StringNode): z.ZodString => {
  const trimmed = node.trim === true ? z.string().trim() : z.string()
  const minLength = node.minLength
  const pattern = node.pattern
  const tooShort = node.message ?? `must be at least ${String(minLength)} characters`
  const bounded = minLength === undefined ? trimmed : trimmed.min(minLength, tooShort)
  return pattern === undefined ? bounded : bounded.regex(new RegExp(pattern), node.message ?? `must match the pattern ${pattern}`)
}

const buildString = (node: StringNode): z.ZodType => {
  const checked = stringChecks(node)
  return node.coerceFrom === undefined ? checked : z.preprocess(finiteNumberAsString, checked)
}

const buildNumber = (node: NumberNode | IntegerNode): z.ZodType => {
  const base = node.type === 'integer' ? z.number().int() : z.number()
  const min = node.min
  const max = node.max
  const floored = min === undefined ? base : base.gte(min, node.message ?? `must be at least ${String(min)}`)
  const bounded = max === undefined ? floored : floored.lte(max, node.message ?? `must be at most ${String(max)}`)
  return node.coerceFrom === undefined ? bounded : z.preprocess(numericStringAsNumber, bounded)
}

const identityOf = (item: unknown, unique: true | string): unknown => {
  if (unique === true) return JSON.stringify(item)
  return isRecord(item) ? item[unique] : undefined
}

const repeats = (items: readonly unknown[], unique: true | string): ItemPath[] => {
  return items.flatMap((item, index): ItemPath[] => {
    const identity = identityOf(item, unique)
    const repeated = identity !== undefined && items.slice(0, index).some(prior => identityOf(prior, unique) === identity)
    if (!repeated) return []
    return [unique === true ? [index] : [index, unique]]
  })
}

const distinctItems = (listed: z.ZodArray<z.ZodType>, unique: true | string, message: string): z.ZodArray<z.ZodType> => {
  return listed.superRefine((values, context) => {
    for (const path of repeats(values, unique)) context.addIssue({ code: 'custom', message, path, input: values })
  })
}

const buildArray = (node: ArrayNode, definitions: Definitions): z.ZodType => {
  const items = build(node.items, definitions)
  const minLength = node.minLength
  const unique = node.unique
  const array = z.array(items)
  const listed = minLength === undefined ? array : array.min(minLength, node.message ?? `must have at least ${String(minLength)} items`)
  const distinct = unique === undefined ? listed : distinctItems(listed, unique, node.message ?? 'must not repeat an item')
  return node.acceptSingle === true ? z.union([distinct, items.transform(item => [item])]) : distinct
}

const buildRecord = (node: RecordNode, definitions: Definitions): z.ZodType => {
  const keyed = z.record(node.keys === undefined ? z.string() : stringChecks(node.keys), build(node.values, definitions))
  const refused = node.refusedKeys
  if (refused === undefined) return keyed
  return keyed.superRefine((value, context) => {
    for (const [key, message] of Object.entries(refused)) {
      if (Object.hasOwn(value, key)) context.addIssue({ code: 'custom', message, path: [key], input: value })
    }
  })
}

const shapeEntry = (node: Definition, definitions: Definitions): z.ZodType => {
  const built = build(node, definitions)
  const fallback = node.default
  if (fallback !== undefined) return built.default(() => copyOf(fallback, false))
  return node.optional === true ? built.optional() : built
}

const objectOf = (shape: Record<string, z.ZodType>, rest: ObjectNode['rest'], definitions: Definitions): ObjectSchema => {
  if (rest === undefined) return z.strictObject(shape)
  if (rest === 'strip') return z.object(shape)
  return z.object(shape).catchall(build(rest, definitions))
}

const requiringOneOf = (object: ObjectSchema, keys: readonly [string, ...string[]], message: string): ObjectSchema => {
  return object.superRefine((value, context) => {
    if (!keys.some(key => value[key] !== undefined)) context.addIssue({ code: 'custom', message, path: [keys[0]], input: value })
  })
}

const buildObject = (node: ObjectNode, definitions: Definitions) => {
  const refusedKeys = node.refusedKeys ?? {}
  const shape = Object.entries(node.shape).map(([key, entry]): [string, z.ZodType] => [key, shapeEntry(entry, definitions)])
  const refused = Object.entries(refusedKeys).map(([key, message]): [string, z.ZodType] => [key, z.undefined(message).optional()])
  const object = objectOf(Object.fromEntries([...shape, ...refused]), node.rest, definitions)
  const oneOf = node.requireOneOf
  const checked = oneOf === undefined ? object : requiringOneOf(object, oneOf, node.message ?? `must have one of: ${oneOf.join(', ')}`)
  const optionalKeys = Object.entries(node.shape)
    .filter(([, entry]) => entry.optional === true)
    .map(([key]) => key)
  const dropped = [...optionalKeys, ...Object.keys(refusedKeys)]
  const kept = (key: string, entry: unknown): boolean => entry !== undefined || !dropped.includes(key)
  return checked.transform(value => Object.fromEntries(Object.entries(value).filter(([key, entry]) => kept(key, entry))))
}

const nullAs = (node: ObjectNode, built: z.ZodType): z.ZodType => {
  const replacement = node.nullAs
  if (replacement === undefined) return built
  return z.preprocess((value: unknown) => (value === null ? copyOf(replacement, false) : value), built)
}

const buildDiscriminatedUnion = (node: DiscriminatedUnionNode, definitions: Definitions): z.ZodType => {
  const [first, ...rest] = node.members.map(member => buildObject(member, definitions))
  if (first === undefined) return z.never()
  return z.discriminatedUnion(node.discriminator, [first, ...rest])
}

const referenced = (name: string, definitions: Definitions): z.ZodType => {
  const target = Object.hasOwn(definitions, name) ? definitions[name] : undefined
  return target === undefined ? z.never() : build(target, definitions)
}

const lazyRef = (name: string, definitions: Definitions): z.ZodType => z.lazy(() => referenced(name, definitions))

export const build = (node: Definition, definitions: Definitions): z.ZodType => {
  switch (node.type) {
    case 'string':
      return buildString(node)
    case 'number':
    case 'integer':
      return buildNumber(node)
    case 'boolean':
      return z.boolean()
    case 'null':
      return z.null()
    case 'literal':
      return z.literal(node.value)
    case 'enum':
      return z.enum(node.values)
    case 'array':
      return buildArray(node, definitions)
    case 'record':
      return buildRecord(node, definitions)
    case 'object':
      return nullAs(node, buildObject(node, definitions))
    case 'union':
      return z.union(node.members.map(member => build(member, definitions)))
    case 'discriminatedUnion':
      return buildDiscriminatedUnion(node, definitions)
    case 'unknown':
      return z.unknown()
    case 'ref':
      return lazyRef(node.name, definitions)
  }
}
