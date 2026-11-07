export const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null

const sealed = (copy: object, frozen: boolean): object => (frozen ? Object.freeze(copy) : copy)

export const copyOf = (value: unknown, frozen: boolean): unknown => {
  if (Array.isArray(value))
    return sealed(
      value.map((item: unknown) => copyOf(item, frozen)),
      frozen,
    )
  if (!isRecord(value)) return value
  return sealed(Object.fromEntries(Object.entries(value).map(([key, item]): [string, unknown] => [key, copyOf(item, frozen)])), frozen)
}
