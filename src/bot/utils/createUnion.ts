/* eslint-disable @typescript-eslint/explicit-function-return-type */

/* eslint-disable @typescript-eslint/no-explicit-any */

/* eslint-disable @typescript-eslint/strict-boolean-expressions */

/* eslint-disable functional/immutable-data */

/**
 * source: https://github.com/AlexGalays/spacelift/blob/be302c4807b23114de27dda6a90b315c3af56631/src/union.ts
 */
import type { List } from '../../shared/utils/fp'

/* eslint-disable functional/no-expression-statement */
type UnionDescription = Record<string, (...args: List<any>) => any>

type UnionResult<T extends UnionDescription> = {
  readonly T: Union<T>
  readonly is: <NAME extends keyof T>(
    name: NAME,
  ) => <U extends Union<T>>(other: U) => other is MyReturnType<T[NAME]> & { readonly type: NAME }
} & { readonly [K in keyof T]: Factory<T[K], K> & { readonly T: MyReturnType<Factory<T[K], K>> } }

// Same as the std lib's ReturnType but without the constraint on T as the compiler can't check it against Arguments<F>
type MyReturnType<T> = T extends (...args: List<any>) => infer R ? R : any

type Factory<F extends (...args: List<any>) => any, TYPE> = (
  ...args: Arguments<F>
) => F extends (...args_: List<any>) => infer R
  ? { readonly [K in keyof R | 'type']: K extends 'type' ? TYPE : R[K & keyof R] }
  : (...args_: List<any>) => any

type Union<T extends UnionDescription> = {
  readonly [K in keyof T]: {
    readonly [K2 in keyof MyReturnType<T[K]> | 'type']: K2 extends 'type'
      ? K
      : MyReturnType<T[K]>[K2]
  }
}[keyof T]

// Note: This has a small limitation in tooltips: https://github.com/Microsoft/TypeScript/issues/28127
type Arguments<T extends (...args: List<any>) => any> = T extends (...args: infer A) => any
  ? A
  : readonly []

/**
 * Creates a type-safe union, providing: derived types, factories and type-guards in a single declaration.
 */
export function createUnion<D extends UnionDescription>(description: D): UnionResult<D> {
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

  return {
    ...factories,
    is,
  } as any
}
