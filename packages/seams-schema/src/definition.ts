interface NodeOptions {
  readonly optional?: boolean
  readonly default?: unknown
}

export interface StringNode extends NodeOptions {
  readonly type: 'string'
  readonly minLength?: number
  readonly pattern?: string
  readonly trim?: boolean
  readonly coerceFrom?: readonly ['number']
  readonly brand?: string
  readonly message?: string
}

export interface NumberNode extends NodeOptions {
  readonly type: 'number'
  readonly min?: number
  readonly max?: number
  readonly coerceFrom?: readonly ['string']
  readonly brand?: string
  readonly message?: string
}

export interface IntegerNode extends NodeOptions {
  readonly type: 'integer'
  readonly min?: number
  readonly max?: number
  readonly coerceFrom?: readonly ['string']
  readonly brand?: string
  readonly message?: string
}

export interface BooleanNode extends NodeOptions {
  readonly type: 'boolean'
}

export interface NullNode extends NodeOptions {
  readonly type: 'null'
}

export interface LiteralNode extends NodeOptions {
  readonly type: 'literal'
  readonly value: string | number | boolean | null
}

export interface EnumNode extends NodeOptions {
  readonly type: 'enum'
  readonly values: readonly [string, ...string[]]
}

export interface ArrayNode extends NodeOptions {
  readonly type: 'array'
  readonly items: Definition
  readonly minLength?: number
  readonly acceptSingle?: boolean
  readonly unique?: true | string
  readonly message?: string
}

export interface RecordNode extends NodeOptions {
  readonly type: 'record'
  readonly values: Definition
  readonly keys?: StringNode
  readonly refusedKeys?: Readonly<Record<string, string>>
}

export interface ObjectNode extends NodeOptions {
  readonly type: 'object'
  readonly shape: Readonly<Record<string, Definition>>
  readonly rest?: Definition | 'strip'
  readonly nullAs?: unknown
  readonly refusedKeys?: Readonly<Record<string, string>>
  readonly requireOneOf?: readonly [string, ...string[]]
  readonly message?: string
}

export interface UnionNode extends NodeOptions {
  readonly type: 'union'
  readonly members: readonly Definition[]
}

export interface DiscriminatedUnionNode extends NodeOptions {
  readonly type: 'discriminatedUnion'
  readonly discriminator: string
  readonly members: readonly ObjectNode[]
}

export interface UnknownNode extends NodeOptions {
  readonly type: 'unknown'
  readonly because: string
}

export interface RefNode extends NodeOptions {
  readonly type: 'ref'
  readonly name: string
}

export type Definition =
  | StringNode
  | NumberNode
  | IntegerNode
  | BooleanNode
  | NullNode
  | LiteralNode
  | EnumNode
  | ArrayNode
  | RecordNode
  | ObjectNode
  | UnionNode
  | DiscriminatedUnionNode
  | UnknownNode
  | RefNode

type NodeKey = 'type' | 'optional' | 'default'

interface VocabularyKeys {
  readonly string: NodeKey | 'minLength' | 'pattern' | 'trim' | 'coerceFrom' | 'brand' | 'message'
  readonly number: NodeKey | 'min' | 'max' | 'coerceFrom' | 'brand' | 'message'
  readonly integer: NodeKey | 'min' | 'max' | 'coerceFrom' | 'brand' | 'message'
  readonly boolean: NodeKey
  readonly null: NodeKey
  readonly literal: NodeKey | 'value'
  readonly enum: NodeKey | 'values'
  readonly array: NodeKey | 'items' | 'minLength' | 'acceptSingle' | 'unique' | 'message'
  readonly record: NodeKey | 'values' | 'keys' | 'refusedKeys'
  readonly object: NodeKey | 'shape' | 'rest' | 'nullAs' | 'refusedKeys' | 'requireOneOf' | 'message'
  readonly union: NodeKey | 'members'
  readonly discriminatedUnion: NodeKey | 'discriminator' | 'members'
  readonly unknown: NodeKey | 'because'
  readonly ref: NodeKey | 'name'
}

type ValueOf<T> = T[keyof T]

type ExtraKeys<N, RootKey> = N extends { readonly type: infer T extends keyof VocabularyKeys }
  ? Exclude<keyof N, VocabularyKeys[T] | RootKey>
  : keyof N

type ShapeChildren<N> = N extends { readonly shape: infer S } ? ValueOf<S> : never

type DefinitionsChildren<N> = N extends { readonly definitions: infer S } ? ValueOf<S> : never

type RestChild<N> = N extends { readonly rest: infer R } ? Exclude<R, 'strip'> : never

type ItemsChild<N> = N extends { readonly type: 'array'; readonly items: infer I } ? I : never

type RecordValuesChild<N> = N extends { readonly type: 'record'; readonly values: infer V } ? V : never

type RecordKeysChild<N> = N extends { readonly type: 'record'; readonly keys: infer K } ? K : never

type MemberChildren<N> = N extends { readonly members: readonly (infer M)[] } ? M : never

type ChildrenOf<N> =
  | ShapeChildren<N>
  | DefinitionsChildren<N>
  | RestChild<N>
  | ItemsChild<N>
  | RecordValuesChild<N>
  | RecordKeysChild<N>
  | MemberChildren<N>

type EachInVocabulary<C> = C extends unknown ? InVocabulary<C, never> : never

type InVocabulary<N, RootKey> = [ExtraKeys<N, RootKey>] extends [never]
  ? false extends EachInVocabulary<ChildrenOf<N>>
    ? false
    : true
  : false

export type DefinitionsOf<D> = D extends { readonly definitions: infer M } ? M : Record<never, never>

type ObjectAcceptsAny<S, R, Defs, Seen> = [keyof S] extends [never] ? AcceptsAny<R, Defs, Seen> : false

type RefAcceptsAny<K, Defs, Seen> = K extends Seen ? false : K extends keyof Defs ? AcceptsAny<Defs[K], Defs, Seen | K> : false

type AcceptsAny<N, Defs, Seen> = N extends { readonly type: 'unknown' }
  ? true
  : N extends { readonly type: 'record'; readonly values: infer V }
    ? AcceptsAny<V, Defs, Seen>
    : N extends { readonly type: 'array'; readonly items: infer I }
      ? AcceptsAny<I, Defs, Seen>
      : N extends { readonly type: 'object'; readonly shape: infer S; readonly rest: infer R }
        ? ObjectAcceptsAny<S, R, Defs, Seen>
        : N extends { readonly type: 'union'; readonly members: readonly (infer M)[] }
          ? true extends AcceptsAny<M, Defs, Seen>
            ? true
            : false
          : N extends { readonly type: 'ref'; readonly name: infer K }
            ? RefAcceptsAny<K, Defs, Seen>
            : false

type IsValid<D> = InVocabulary<D, 'definitions'> extends true ? (AcceptsAny<D, DefinitionsOf<D>, never> extends true ? false : true) : false

export type Checked<D> = Definition extends D ? unknown : IsValid<D> extends true ? unknown : never
