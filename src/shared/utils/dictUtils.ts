import type { List } from './fp'

// https://typehero.dev/challenge/objectentries/solutions/866
export const objectEntries: <A extends Readonly<Record<PropertyKey, unknown>>>(
  a: A,
) => List<
  {
    [K in keyof A]-?: K extends symbol
      ? never
      : readonly [
          // @ts-expect-error `Type 'symbol' is not assignable to type 'string | number | bigint | boolean | null | undefined'` - BUT THIS CAN'T BE A FUCKING SYMBOL
          `${K}`,
          A[K],
        ]
  }[keyof A]
> = Object.entries
