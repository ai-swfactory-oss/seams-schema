export type ParseOutcome = 'parsed' | 'refused'

export const isParseOutcome = (value: unknown): value is ParseOutcome => value === 'parsed' || value === 'refused'
