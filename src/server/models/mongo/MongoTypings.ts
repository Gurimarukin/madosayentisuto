import type { IndexDirection, IndexDescription as MongoIndexDescription } from 'mongodb'

export type WithoutProjection<T> = T & {
  readonly fields?: undefined
  readonly projection?: undefined
}

export type IndexDescription<A> = Omit<MongoIndexDescription, 'key'> & {
  readonly key: {
    readonly [B in keyof A]?: IndexDirection
  }
}
