import { IndexDescription as MongoIndexDescription } from 'mongodb'

export type WithoutProjection<T> = T & {
  readonly fields?: undefined
  readonly projection?: undefined
}

export type ReadonlyPartial<T> = {
  readonly [K in keyof T]?: T[K]
}

export type IndexDescription<A> = MongoIndexDescription & {
  readonly key: {
    readonly [B in keyof A]?: 1 | -1 | 'text'
  }
}
