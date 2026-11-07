declare const specBrand: unique symbol

interface SpecBrandMark {
  readonly [specBrand]: 'SpecBrand'
}

export type SpecBrandValue = string & SpecBrandMark

declare module '../src/index' {
  interface BrandRegistry {
    readonly SpecBrand: SpecBrandValue
  }
}
