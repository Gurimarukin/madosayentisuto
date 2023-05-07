/* eslint-disable @typescript-eslint/explicit-function-return-type,
                  @typescript-eslint/no-explicit-any,
                  @typescript-eslint/strict-boolean-expressions,
                  functional/immutable-data,
                  functional/no-expression-statements */

/**
 * copypasta from: https://github.com/AlexGalays/spacelift/blob/be302c4807b23114de27dda6a90b315c3af56631/src/union.ts
 */
import type { EnforceNonEmptyDict } from '../models/EnforceNonEmptyDict'
import type { Dict, List } from './fp'

export type UnionDescription = Dict<string, (...args: List<any>) => any>

export type UnionResult<T extends UnionDescription> = {
  T: Union<T>
  is: <NAME extends keyof T>(
    name: NAME,
  ) => <U extends Union<T>>(other: U) => other is ReturnType<T[NAME]> & { type: NAME }
  match: <B>(m: Match<T, B>) => (u: Union<T>) => B
} & { [K in keyof T]: Factory<T[K], K> & { T: ReturnType<Factory<T[K], K>> } }

type Match<T extends UnionDescription, B> = {
  [K in keyof T]: (a: Omit<ReturnType<Factory<T[K], K>>, 'type'>) => B
}

type Factory<F extends (...args: List<any>) => any, TYPE> = (
  ...args: Parameters<F>
) => F extends (...args_: List<any>) => infer R
  ? { [K in keyof R | 'type']: K extends 'type' ? TYPE : R[K & keyof R] }
  : (...args_: List<any>) => any

type Union<T extends UnionDescription> = {
  [K in keyof T]: {
    [K2 in keyof ReturnType<T[K]> | 'type']: K2 extends 'type' ? K : ReturnType<T[K]>[K2]
  }
}[keyof T]

/**
 * Creates a type-safe union, providing: derived types, factories and type-guards in a single declaration.
 */
export function createUnion<D extends UnionDescription>(
  description: EnforceNonEmptyDict<D>,
): UnionResult<D> {
  const factories = Object.keys(description).reduce((acc, key) => {
    const factory = description[key] as (...args: List<any>) => any
    const factoryWithType = (...args: List<any>) => ({
      type: key,
      ...factory(...args),
    })
    acc[key] = factoryWithType
    return acc
  }, {} as any)

  const isCache: any = {}
  function is(type: string): any {
    if (isCache[type]) return isCache[type]
    isCache[type] = (obj: any) => obj.type === type
    return isCache[type]
  }

  const match =
    <B>(m: Match<D, B>) =>
    ({ type, ...rest }: Union<D>): B =>
      m[type](rest as any)

  return {
    ...factories,
    is,
    match,
  } as any
}

/**
 * custom
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type UnionKeys<U> = U extends UnionResult<infer _>
  ? Exclude<keyof U, 'T' | 'is' | 'match'>
  : never

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type UnionTypes<U, K extends UnionKeys<U> = UnionKeys<U>> = U extends UnionResult<infer _>
  ? ReturnType<U[K]>
  : never
