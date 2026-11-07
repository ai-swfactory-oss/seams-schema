import type { Definition, DefinitionsOf } from './definition'

export interface BrandRegistry {
  readonly unregistered: never
}

declare const nominal: unique symbol

interface Nominal<B extends string> {
  readonly [nominal]: B
}

type Branded<Base, N> = N extends { readonly brand: infer B extends string }
  ? B extends keyof BrandRegistry
    ? BrandRegistry[B]
    : Base & Nominal<B>
  : Base

type Flatten<T> = { [K in keyof T]: T[K] }

type IsOptionalKey<N> = N extends { readonly optional: true } ? (N extends { readonly default: unknown } ? false : true) : false

type OptionalKeys<S> = { [K in keyof S]: IsOptionalKey<S[K]> extends true ? K : never }[keyof S]

type RequiredKeys<S> = Exclude<keyof S, OptionalKeys<S>>

type RestOutput<N, Defs> = N extends { readonly rest: infer R extends Definition } ? Record<string, Infer<R, Defs>> : unknown

type ShapeOutput<S, Defs> = Flatten<{ [K in RequiredKeys<S>]: Infer<S[K], Defs> } & { [K in OptionalKeys<S>]?: Infer<S[K], Defs> }>

type ObjectOutput<N, Defs> = N extends { readonly shape: infer S } ? ShapeOutput<S, Defs> & RestOutput<N, Defs> : never

type RefOutput<K, Defs> = K extends keyof Defs ? Infer<Defs[K], Defs> : unknown

type Infer<N, Defs> = N extends { readonly type: 'string' }
  ? Branded<string, N>
  : N extends { readonly type: 'number' | 'integer' }
    ? Branded<number, N>
    : N extends { readonly type: 'boolean' }
      ? boolean
      : N extends { readonly type: 'null' }
        ? null
        : N extends { readonly type: 'literal'; readonly value: infer V }
          ? V
          : N extends { readonly type: 'enum'; readonly values: readonly (infer V)[] }
            ? V
            : N extends { readonly type: 'array'; readonly items: infer I }
              ? Infer<I, Defs>[]
              : N extends { readonly type: 'record'; readonly values: infer V }
                ? Record<string, Infer<V, Defs>>
                : N extends { readonly type: 'object' }
                  ? ObjectOutput<N, Defs>
                  : N extends { readonly members: readonly (infer M)[] }
                    ? Infer<M, Defs>
                    : N extends { readonly type: 'ref'; readonly name: infer K }
                      ? RefOutput<K, Defs>
                      : unknown

export type OutputOf<D> = Definition extends D ? unknown : Infer<D, DefinitionsOf<D>>
